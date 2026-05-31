
# Create a proper startup that works on Render
"""
ArgonTube - Video Sharing Platform
Main Application File
"""

from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import sqlite3
import os
from functools import wraps

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'argon-tube-secret-key-2024')
app.config['UPLOAD_FOLDER'] = os.path.join('/tmp', 'uploads')
app.config['THUMBNAIL_FOLDER'] = os.path.join('/tmp', 'thumbnails')
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024
app.config['ALLOWED_VIDEO_EXTENSIONS'] = {'mp4', 'webm', 'ogg', 'mov', 'avi'}
app.config['ALLOWED_IMAGE_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}
app.config['DATABASE_PATH'] = os.environ.get('DATABASE_PATH', '/tmp/database.db')

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['THUMBNAIL_FOLDER'], exist_ok=True)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database connection
def get_db():
    conn = sqlite3.connect(app.config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    return conn

# Initialize database
def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        profile_pic TEXT DEFAULT 'default.jpg',
        banner_pic TEXT DEFAULT 'default_banner.jpg',
        about TEXT DEFAULT '',
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT DEFAULT '📹')''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        filename TEXT NOT NULL,
        thumbnail TEXT DEFAULT 'default_thumb.jpg',
        user_id INTEGER NOT NULL,
        category_id INTEGER,
        duration TEXT DEFAULT '0:00',
        views INTEGER DEFAULT 0,
        tags TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        parent_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        is_like INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, video_id))''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(subscriber_id, channel_id))''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, video_id))''')
    
    # Default categories
    cats = [('Gaming','🎮'),('Music','🎵'),('Education','📚'),('Entertainment','🎬'),
            ('Sports','⚽'),('Technology','💻'),('News','📰'),('Comedy','😂')]
    for name, icon in cats:
        try:
            cursor.execute('INSERT INTO categories (name, icon) VALUES (?, ?)', (name, icon))
        except:
            pass
    
    # Default admin
    try:
        cursor.execute('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
                      ('admin', 'admin@argontube.com', generate_password_hash('admin123'), 1))
    except:
        pass
    
    conn.commit()
    conn.close()

# User class
class User(UserMixin):
    def __init__(self, user_data):
        self.id = user_data['id']
        self.username = user_data['username']
        self.email = user_data['email']
        self.is_admin = user_data['is_admin']
        self.profile_pic = user_data.get('profile_pic', 'default.jpg')
        self.banner_pic = user_data.get('banner_pic', 'default_banner.jpg')
        self.created_at = user_data.get('created_at', '')

@login_manager.user_loader
def load_user(user_id):
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return User(dict(user)) if user else None

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('Admin access required!', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def allowed_file(filename, file_type):
    allowed = app.config['ALLOWED_VIDEO_EXTENSIONS'] if file_type == 'video' else app.config['ALLOWED_IMAGE_EXTENSIONS']
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed

def get_video_likes_count(video_id):
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM likes WHERE video_id = ? AND is_like = 1', (video_id,)).fetchone()[0]
    conn.close()
    return count

def get_video_dislikes_count(video_id):
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM likes WHERE video_id = ? AND is_like = 0', (video_id,)).fetchone()[0]
    conn.close()
    return count

def get_subscriber_count(channel_id):
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM subscribers WHERE channel_id = ?', (channel_id,)).fetchone()[0]
    conn.close()
    return count

def is_subscribed(subscriber_id, channel_id):
    conn = get_db()
    sub = conn.execute('SELECT * FROM subscribers WHERE subscriber_id = ? AND channel_id = ?',
                      (subscriber_id, channel_id)).fetchone()
    conn.close()
    return sub is not None

def get_trending_videos(limit=8):
    conn = get_db()
    videos = conn.execute('''SELECT v.*, u.username as channel_name, u.profile_pic
        FROM videos v JOIN users u ON v.user_id = u.id
        ORDER BY v.views DESC, v.created_at DESC LIMIT ?''', (limit,)).fetchall()
    conn.close()
    return videos

def get_related_videos(video_id, category_id, limit=6):
    conn = get_db()
    videos = conn.execute('''SELECT v.*, u.username as channel_name
        FROM videos v JOIN users u ON v.user_id = u.id
        WHERE v.category_id = ? AND v.id != ? ORDER BY v.created_at DESC LIMIT ?''',
        (category_id, video_id, limit)).fetchall()
    conn.close()
    return videos

@app.context_processor
def inject_globals():
    conn = get_db()
    categories = conn.execute('SELECT * FROM categories').fetchall()
    conn.close()
    return dict(categories=categories)

@app.route('/')
def home():
    trending_videos = get_trending_videos(8)
    conn = get_db()
    latest_videos = conn.execute('''SELECT v.*, u.username as channel_name
        FROM videos v JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC LIMIT 8''').fetchall()
    conn.close()
    return render_template('index.html', trending_videos=trending_videos, latest_videos=latest_videos)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not all([username, email, password, confirm_password]):
            flash('All fields are required!', 'error')
            return redirect(url_for('register'))
        if password != confirm_password:
            flash('Passwords do not match!', 'error')
            return redirect(url_for('register'))
        if len(password) < 6:
            flash('Password must be at least 6 characters!', 'error')
            return redirect(url_for('register'))
        
        conn = get_db()
        existing = conn.execute('SELECT * FROM users WHERE username = ? OR email = ?', (username, email)).fetchone()
        if existing:
            flash('Username or email already exists!', 'error')
            conn.close()
            return redirect(url_for('register'))
        
        try:
            conn.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                        (username, email, generate_password_hash(password)))
            conn.commit()
            flash('Registration successful! Please login.', 'success')
            return redirect(url_for('login'))
        except:
            flash('Registration failed!', 'error')
        finally:
            conn.close()
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        conn = get_db()
        user = conn.execute('SELECT * FROM users WHERE username = ? OR email = ?', (username, username)).fetchone()
        conn.close()
        if user and check_password_hash(user['password_hash'], password):
            login_user(User(dict(user)))
            flash('Logged in successfully!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('home'))
        flash('Invalid username or password!', 'error')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully!', 'success')
    return redirect(url_for('home'))

@app.route('/profile')
@login_required
def profile():
    conn = get_db()
    videos = conn.execute('''SELECT v.*, c.name as category_name
        FROM videos v LEFT JOIN categories c ON v.category_id = c.id
        WHERE v.user_id = ? ORDER BY v.created_at DESC''', (current_user.id,)).fetchall()
    conn.close()
    return render_template('profile.html', videos=videos)

@app.route('/upload', methods=['GET', 'POST'])
@login_required
def upload():
    if request.method == 'POST':
        title = request.form.get('title')
        if not title:
            flash('Video title is required!', 'error')
            return redirect(url_for('upload'))
        if 'video' not in request.files or request.files['video'].filename == '':
            flash('No video file selected!', 'error')
            return redirect(url_for('upload'))
        
        video_file = request.files['video']
        if video_file and allowed_file(video_file.filename, 'video'):
            video_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{video_file.filename}")
            video_file.save(os.path.join(app.config['UPLOAD_FOLDER'], video_filename))
        else:
            flash('Invalid video file format!', 'error')
            return redirect(url_for('upload'))
        
        thumbnail_filename = 'default_thumb.jpg'
        if 'thumbnail' in request.files:
            thumb = request.files['thumbnail']
            if thumb.filename != '' and allowed_file(thumb.filename, 'image'):
                thumbnail_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{thumb.filename}")
                thumb.save(os.path.join(app.config['THUMBNAIL_FOLDER'], thumbnail_filename))
        
        conn = get_db()
        try:
            conn.execute('''INSERT INTO videos (title, description, filename, thumbnail, user_id, category_id, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (title, request.form.get('description', ''), video_filename, thumbnail_filename,
                 current_user.id, request.form.get('category'), request.form.get('tags', '')))
            conn.commit()
            flash('Video uploaded successfully!', 'success')
            return redirect(url_for('profile'))
        except:
            flash('Upload failed!', 'error')
        finally:
            conn.close()
    
    conn = get_db()
    categories = conn.execute('SELECT * FROM categories').fetchall()
    conn.close()
    return render_template('upload.html', categories=categories)

@app.route('/watch/<int:video_id>')
def watch(video_id):
    conn = get_db()
    video = conn.execute('''SELECT v.*, u.username as channel_name, u.profile_pic, u.id as channel_id, c.name as category_name
        FROM videos v JOIN users u ON v.user_id = u.id
        LEFT JOIN categories c ON v.category_id = c.id WHERE v.id = ?''', (video_id,)).fetchone()
    if not video:
        conn.close()
        flash('Video not found!', 'error')
        return redirect(url_for('home'))
    
    conn.execute('UPDATE videos SET views = views + 1 WHERE id = ?', (video_id,))
    conn.commit()
    
    if current_user.is_authenticated:
        try:
            conn.execute('INSERT INTO watch_history (user_id, video_id) VALUES (?, ?)', (current_user.id, video_id))
            conn.commit()
        except:
            pass
    
    comments = conn.execute('''SELECT c.*, u.username, u.profile_pic FROM comments c
        JOIN users u ON c.user_id = u.id WHERE c.video_id = ? AND c.parent_id IS NULL
        ORDER BY c.created_at DESC''', (video_id,)).fetchall()
    
    comments_with_replies = []
    for comment in comments:
        replies = conn.execute('''SELECT c.*, u.username, u.profile_pic FROM comments c
            JOIN users u ON c.user_id = u.id WHERE c.parent_id = ? ORDER BY c.created_at ASC''',
            (comment['id'],)).fetchall()
        comments_with_replies.append({'comment': comment, 'replies': replies})
    
    related_videos = get_related_videos(video_id, video['category_id'])
    likes_count = get_video_likes_count(video_id)
    dislikes_count = get_video_dislikes_count(video_id)
    
    user_like_status = None
    if current_user.is_authenticated:
        like = conn.execute('SELECT is_like FROM likes WHERE user_id = ? AND video_id = ?',
                           (current_user.id, video_id)).fetchone()
        if like:
            user_like_status = like['is_like']
    
    is_sub = is_subscribed(current_user.id, video['channel_id']) if current_user.is_authenticated else False
    sub_count = get_subscriber_count(video['channel_id'])
    conn.close()
    
    return render_template('watch.html', video=video, comments_with_replies=comments_with_replies,
                         related_videos=related_videos, likes_count=likes_count, dislikes_count=dislikes_count,
                         user_like_status=user_like_status, is_subscribed=is_sub, subscriber_count=sub_count)

@app.route('/add_comment/<int:video_id>', methods=['POST'])
@login_required
def add_comment(video_id):
    content = request.form.get('content')
    if not content:
        flash('Comment cannot be empty!', 'error')
        return redirect(url_for('watch', video_id=video_id))
    parent_id = request.form.get('parent_id')
    conn = get_db()
    try:
        conn.execute('INSERT INTO comments (content, user_id, video_id, parent_id) VALUES (?, ?, ?, ?)',
                    (content, current_user.id, video_id, parent_id if parent_id else None))
        conn.commit()
        flash('Comment added!', 'success')
    except:
        flash('Failed to add comment!', 'error')
    finally:
        conn.close()
    return redirect(url_for('watch', video_id=video_id))

@app.route('/delete_comment/<int:comment_id>')
@login_required
def delete_comment(comment_id):
    conn = get_db()
    comment = conn.execute('SELECT * FROM comments WHERE id = ?', (comment_id,)).fetchone()
    if comment and (comment['user_id'] == current_user.id or current_user.is_admin):
        conn.execute('DELETE FROM comments WHERE id = ? OR parent_id = ?', (comment_id, comment_id))
        conn.commit()
        flash('Comment deleted!', 'success')
    conn.close()
    return redirect(request.referrer or url_for('home'))

@app.route('/like/<int:video_id>/<action>')
@login_required
def like_video(video_id, action):
    conn = get_db()
    is_like = 1 if action == 'like' else 0
    existing = conn.execute('SELECT * FROM likes WHERE user_id = ? AND video_id = ?',
                           (current_user.id, video_id)).fetchone()
    if existing:
        if existing['is_like'] == is_like:
            conn.execute('DELETE FROM likes WHERE id = ?', (existing['id'],))
        else:
            conn.execute('UPDATE likes SET is_like = ? WHERE id = ?', (is_like, existing['id']))
    else:
        conn.execute('INSERT INTO likes (user_id, video_id, is_like) VALUES (?, ?, ?)',
                    (current_user.id, video_id, is_like))
    conn.commit()
    conn.close()
    return redirect(url_for('watch', video_id=video_id))

@app.route('/subscribe/<int:channel_id>')
@login_required
def subscribe(channel_id):
    if channel_id == current_user.id:
        flash('You cannot subscribe to yourself!', 'error')
        return redirect(request.referrer or url_for('home'))
    conn = get_db()
    existing = conn.execute('SELECT * FROM subscribers WHERE subscriber_id = ? AND channel_id = ?',
                           (current_user.id, channel_id)).fetchone()
    if existing:
        conn.execute('DELETE FROM subscribers WHERE id = ?', (existing['id'],))
    else:
        conn.execute('INSERT INTO subscribers (subscriber_id, channel_id) VALUES (?, ?)',
                    (current_user.id, channel_id))
    conn.commit()
    conn.close()
    return redirect(request.referrer or url_for('home'))

@app.route('/channel/<int:channel_id>')
def channel(channel_id):
    conn = get_db()
    channel_user = conn.execute('SELECT * FROM users WHERE id = ?', (channel_id,)).fetchone()
    if not channel_user:
        conn.close()
        flash('Channel not found!', 'error')
        return redirect(url_for('home'))
    videos = conn.execute('''SELECT v.* FROM videos v WHERE v.user_id = ? ORDER BY v.created_at DESC''',
                         (channel_id,)).fetchall()
    sub_count = get_subscriber_count(channel_id)
    is_sub = is_subscribed(current_user.id, channel_id) if current_user.is_authenticated else False
    conn.close()
    return render_template('channel.html', channel_user=channel_user, videos=videos,
                         subscriber_count=sub_count, is_subscribed=is_sub)

@app.route('/search')
def search():
    query = request.args.get('q', '')
    category = request.args.get('category', '')
    conn = get_db()
    sql = '''SELECT v.*, u.username as channel_name FROM videos v
        JOIN users u ON v.user_id = u.id WHERE (v.title LIKE ? OR v.tags LIKE ? OR v.description LIKE ?)'''
    params = [f'%{query}%'] * 3
    if category:
        sql += ' AND v.category_id = ?'
        params.append(category)
    sql += ' ORDER BY v.created_at DESC'
    videos = conn.execute(sql, params).fetchall()
    conn.close()
    return render_template('search.html', videos=videos, query=query, selected_category=category)

@app.route('/api/search/suggestions')
def search_suggestions():
    query = request.args.get('q', '')
    conn = get_db()
    suggestions = conn.execute('SELECT title FROM videos WHERE title LIKE ? LIMIT 5',
                              (f'%{query}%',)).fetchall()
    conn.close()
    return jsonify([s['title'] for s in suggestions])

@app.route('/api/notifications/count')
@login_required
def notification_count():
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0',
                        (current_user.id,)).fetchone()[0]
    conn.close()
    return jsonify({'count': count})

@app.route('/add_to_favorites/<int:video_id>')
@login_required
def add_to_favorites(video_id):
    conn = get_db()
    existing = conn.execute('SELECT * FROM favorites WHERE user_id = ? AND video_id = ?',
                           (current_user.id, video_id)).fetchone()
    if existing:
        conn.execute('DELETE FROM favorites WHERE id = ?', (existing['id'],))
    else:
        conn.execute('INSERT INTO favorites (user_id, video_id) VALUES (?, ?)', (current_user.id, video_id))
    conn.commit()
    conn.close()
    return redirect(request.referrer or url_for('home'))

@app.route('/favorites')
@login_required
def favorites():
    conn = get_db()
    videos = conn.execute('''SELECT v.*, u.username as channel_name FROM favorites f
        JOIN videos v ON f.video_id = v.id JOIN users u ON v.user_id = u.id
        WHERE f.user_id = ? ORDER BY f.created_at DESC''', (current_user.id,)).fetchall()
    conn.close()
    return render_template('favorites.html', videos=videos)

@app.route('/history')
@login_required
def history():
    conn = get_db()
    videos = conn.execute('''SELECT DISTINCT v.*, u.username as channel_name, MAX(w.watched_at) as last_watched
        FROM watch_history w JOIN videos v ON w.video_id = v.id JOIN users u ON v.user_id = u.id
        WHERE w.user_id = ? GROUP BY v.id ORDER BY last_watched DESC''', (current_user.id,)).fetchall()
    conn.close()
    return render_template('history.html', videos=videos)

@app.route('/notifications')
@login_required
def notifications():
    conn = get_db()
    user_notifications = conn.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
                                     (current_user.id,)).fetchall()
    conn.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', (current_user.id,))
    conn.commit()
    conn.close()
    return render_template('notifications.html', notifications=user_notifications)

@app.route('/admin')
@login_required
@admin_required
def admin_panel():
    conn = get_db()
    total_users = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    total_videos = conn.execute('SELECT COUNT(*) FROM videos').fetchone()[0]
    total_views = conn.execute('SELECT SUM(views) FROM videos').fetchone()[0] or 0
    total_comments = conn.execute('SELECT COUNT(*) FROM comments').fetchone()[0]
    recent_videos = conn.execute('''SELECT v.*, u.username FROM videos v
        JOIN users u ON v.user_id = u.id ORDER BY v.created_at DESC LIMIT 10''').fetchall()
    recent_users = conn.execute('SELECT * FROM users ORDER BY created_at DESC LIMIT 10').fetchall()
    conn.close()
    return render_template('admin.html', total_users=total_users, total_videos=total_videos,
                         total_views=total_views, total_comments=total_comments,
                         recent_videos=recent_videos, recent_users=recent_users)

@app.route('/admin/delete_video/<int:video_id>')
@login_required
@admin_required
def admin_delete_video(video_id):
    conn = get_db()
    conn.execute('DELETE FROM comments WHERE video_id = ?', (video_id,))
    conn.execute('DELETE FROM likes WHERE video_id = ?', (video_id,))
    conn.execute('DELETE FROM watch_history WHERE video_id = ?', (video_id,))
    conn.execute('DELETE FROM favorites WHERE video_id = ?', (video_id,))
    conn.execute('DELETE FROM videos WHERE id = ?', (video_id,))
    conn.commit()
    conn.close()
    flash('Video deleted!', 'success')
    return redirect(url_for('admin_panel'))

@app.route('/admin/delete_user/<int:user_id>')
@login_required
@admin_required
def admin_delete_user(user_id):
    if user_id == current_user.id:
        flash('You cannot delete yourself!', 'error')
        return redirect(url_for('admin_panel'))
    conn = get_db()
    conn.execute('DELETE FROM comments WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM likes WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM subscribers WHERE subscriber_id = ? OR channel_id = ?', (user_id, user_id))
    conn.execute('DELETE FROM watch_history WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM favorites WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM notifications WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM videos WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    flash('User deleted!', 'success')
    return redirect(url_for('admin_panel'))

@app.route('/video/<filename>')
def serve_video(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# Initialize database
init_db()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
ENDOFFILE

