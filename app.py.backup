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
import json
from functools import wraps

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'argon-tube-secret-key-2024')
app.config['SECRET_KEY'] = 'argon-tube-secret-key-2024'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['THUMBNAIL_FOLDER'] = 'static/thumbnails'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size
app.config['ALLOWED_VIDEO_EXTENSIONS'] = {'mp4', 'webm', 'ogg', 'mov', 'avi'}
app.config['ALLOWED_IMAGE_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}

# Ensure upload directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['THUMBNAIL_FOLDER'], exist_ok=True)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database connection
def get_db():
    """Get database connection"""
   # Use /tmp for database on Render (persistent storage)
db_path = os.environ.get('DATABASE_PATH', 'database.db')
conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize database
def init_db():
    """Create database tables"""
    conn = get_db()
    cursor = conn.cursor()
# Context processor to make categories available in all templates
@app.context_processor
def inject_categories():
    """Make categories available in all templates"""
    conn = get_db()
    categories = conn.execute('SELECT * FROM categories').fetchall()
    conn.close()
    return dict(categories=categories)    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            profile_pic TEXT DEFAULT 'default.jpg',
            banner_pic TEXT DEFAULT 'default_banner.jpg',
            about TEXT DEFAULT '',
            is_admin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            icon TEXT DEFAULT '📹'
        )
    ''')
    
    # Videos table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS videos (
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    ''')
    
    # Comments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (video_id) REFERENCES videos (id),
            FOREIGN KEY (parent_id) REFERENCES comments (id)
        )
    ''')
    
    # Likes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            is_like INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (video_id) REFERENCES videos (id),
            UNIQUE(user_id, video_id)
        )
    ''')
    
    # Subscribers table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscriber_id INTEGER NOT NULL,
            channel_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subscriber_id) REFERENCES users (id),
            FOREIGN KEY (channel_id) REFERENCES users (id),
            UNIQUE(subscriber_id, channel_id)
        )
    ''')
    
    # Notifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Watch history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS watch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (video_id) REFERENCES videos (id)
        )
    ''')
    
    # Favorites table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (video_id) REFERENCES videos (id),
            UNIQUE(user_id, video_id)
        )
    ''')
    
    # Insert default categories if not exists
    default_categories = [
        ('Gaming', '🎮'),
        ('Music', '🎵'),
        ('Education', '📚'),
        ('Entertainment', '🎬'),
        ('Sports', '⚽'),
        ('Technology', '💻'),
        ('News', '📰'),
        ('Comedy', '😂')
    ]
    
    for cat in default_categories:
        try:
            cursor.execute('INSERT INTO categories (name, icon) VALUES (?, ?)', cat)
        except:
            pass
    
    # Create default admin user
    admin_password = generate_password_hash('admin123')
    try:
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, is_admin)
            VALUES (?, ?, ?, ?)
        ''', ('admin', 'admin@argontube.com', admin_password, 1))
    except:
        pass
    
    conn.commit()
    conn.close()

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, user_data):
        self.id = user_data['id']
        self.username = user_data['username']
        self.email = user_data['email']
        self.is_admin = user_data['is_admin']
        self.profile_pic = user_data.get('profile_pic', 'default.jpg')
        self.banner_pic = user_data.get('banner_pic', 'default_banner.jpg')
        self.created_at = user_data.get('created_at', '')
        self.about = user_data.get('about', '')
@login_manager.user_loader
def load_user(user_id):
    """Load user from database"""
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    if user:
        return User(dict(user))
    return None

# Admin required decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('Admin access required!', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# File validation
def allowed_file(filename, file_type):
    """Check if file extension is allowed"""
    if file_type == 'video':
        allowed = app.config['ALLOWED_VIDEO_EXTENSIONS']
    else:
        allowed = app.config['ALLOWED_IMAGE_EXTENSIONS']
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed

# Helper functions
def get_video_likes_count(video_id):
    """Get number of likes for a video"""
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM likes WHERE video_id = ? AND is_like = 1', (video_id,)).fetchone()[0]
    conn.close()
    return count

def get_video_dislikes_count(video_id):
    """Get number of dislikes for a video"""
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM likes WHERE video_id = ? AND is_like = 0', (video_id,)).fetchone()[0]
    conn.close()
    return count

def get_subscriber_count(channel_id):
    """Get subscriber count for a channel"""
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM subscribers WHERE channel_id = ?', (channel_id,)).fetchone()[0]
    conn.close()
    return count

def is_subscribed(subscriber_id, channel_id):
    """Check if user is subscribed to channel"""
    conn = get_db()
    sub = conn.execute('SELECT * FROM subscribers WHERE subscriber_id = ? AND channel_id = ?', 
                      (subscriber_id, channel_id)).fetchone()
    conn.close()
    return sub is not None

def get_trending_videos(limit=8):
    """Get trending videos based on views and recency"""
    conn = get_db()
    videos = conn.execute('''
        SELECT v.*, u.username as channel_name, u.profile_pic, 
               c.name as category_name
        FROM videos v
        JOIN users u ON v.user_id = u.id
        LEFT JOIN categories c ON v.category_id = c.id
        ORDER BY v.views DESC, v.created_at DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return videos

def get_related_videos(video_id, category_id, limit=6):
    """Get related videos from same category"""
    conn = get_db()
    videos = conn.execute('''
        SELECT v.*, u.username as channel_name
        FROM videos v
        JOIN users u ON v.user_id = u.id
        WHERE v.category_id = ? AND v.id != ?
        ORDER BY v.created_at DESC
        LIMIT ?
    ''', (category_id, video_id, limit)).fetchall()
    conn.close()
    return videos

# Routes
@app.route('/')
def home():
    """Home page route"""
    trending_videos = get_trending_videos(8)
    conn = get_db()
    latest_videos = conn.execute('''
        SELECT v.*, u.username as channel_name
        FROM videos v
        JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
        LIMIT 8
    ''').fetchall()
    conn.close()
    return render_template('index.html', 
                         trending_videos=trending_videos,
                         latest_videos=latest_videos)
@app.route('/register', methods=['GET', 'POST'])
def register():
    """User registration route"""
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validation
        if not all([username, email, password, confirm_password]):
            flash('All fields are required!', 'error')
            return redirect(url_for('register'))
        
        if password != confirm_password:
            flash('Passwords do not match!', 'error')
            return redirect(url_for('register'))
        
        if len(password) < 6:
            flash('Password must be at least 6 characters!', 'error')
            return redirect(url_for('register'))
        
        # Check if user exists
        conn = get_db()
        existing_user = conn.execute('SELECT * FROM users WHERE username = ? OR email = ?', 
                                    (username, email)).fetchone()
        
        if existing_user:
            flash('Username or email already exists!', 'error')
            conn.close()
            return redirect(url_for('register'))
        
        # Create user
        password_hash = generate_password_hash(password)
        try:
            conn.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                        (username, email, password_hash))
            conn.commit()
            flash('Registration successful! Please login.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            flash('Registration failed!', 'error')
        finally:
            conn.close()
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login route"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        conn = get_db()
        user = conn.execute('SELECT * FROM users WHERE username = ? OR email = ?', 
                           (username, username)).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            user_obj = User(dict(user))
            login_user(user_obj)
            flash('Logged in successfully!', 'success')
            
            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            return redirect(url_for('home'))
        else:
            flash('Invalid username or password!', 'error')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    """Logout route"""
    logout_user()
    flash('Logged out successfully!', 'success')
    return redirect(url_for('home'))

@app.route('/profile')
@login_required
def profile():
    """User profile page"""
    conn = get_db()
    user_videos = conn.execute('''
        SELECT v.*, c.name as category_name
        FROM videos v
        LEFT JOIN categories c ON v.category_id = c.id
        WHERE v.user_id = ?
        ORDER BY v.created_at DESC
    ''', (current_user.id,)).fetchall()
    conn.close()
    return render_template('profile.html', videos=user_videos)

@app.route('/upload', methods=['GET', 'POST'])
@login_required
def upload():
    """Video upload route"""
    if request.method == 'POST':
        title = request.form.get('title')
        description = request.form.get('description')
        category_id = request.form.get('category')
        tags = request.form.get('tags')
        
        # Validate required fields
        if not title:
            flash('Video title is required!', 'error')
            return redirect(url_for('upload'))
        
        # Handle video file
        if 'video' not in request.files:
            flash('No video file selected!', 'error')
            return redirect(url_for('upload'))
        
        video_file = request.files['video']
        if video_file.filename == '':
            flash('No video file selected!', 'error')
            return redirect(url_for('upload'))
        
        if video_file and allowed_file(video_file.filename, 'video'):
            video_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{video_file.filename}")
            video_path = os.path.join(app.config['UPLOAD_FOLDER'], video_filename)
            video_file.save(video_path)
        else:
            flash('Invalid video file format!', 'error')
            return redirect(url_for('upload'))
        
        # Handle thumbnail
        thumbnail_filename = 'default_thumb.jpg'
        if 'thumbnail' in request.files:
            thumbnail_file = request.files['thumbnail']
            if thumbnail_file.filename != '' and allowed_file(thumbnail_file.filename, 'image'):
                thumbnail_filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{thumbnail_file.filename}")
                thumbnail_path = os.path.join(app.config['THUMBNAIL_FOLDER'], thumbnail_filename)
                thumbnail_file.save(thumbnail_path)
        
        # Save to database
        conn = get_db()
        try:
            conn.execute('''
                INSERT INTO videos (title, description, filename, thumbnail, user_id, category_id, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (title, description, video_filename, thumbnail_filename, current_user.id, category_id, tags))
            conn.commit()
            flash('Video uploaded successfully!', 'success')
            return redirect(url_for('profile'))
        except Exception as e:
            flash('Upload failed! Please try again.', 'error')
        finally:
            conn.close()
    
    conn = get_db()
    categories = conn.execute('SELECT * FROM categories').fetchall()
    conn.close()
    return render_template('upload.html', categories=categories)

@app.route('/watch/<int:video_id>')
def watch(video_id):
    """Video watch page"""
    conn = get_db()
    video = conn.execute('''
        SELECT v.*, u.username as channel_name, u.profile_pic, u.id as channel_id,
               c.name as category_name
        FROM videos v
        JOIN users u ON v.user_id = u.id
        LEFT JOIN categories c ON v.category_id = c.id
        WHERE v.id = ?
    ''', (video_id,)).fetchone()
    
    if not video:
        flash('Video not found!', 'error')
        return redirect(url_for('home'))
    
    # Update view count
    conn.execute('UPDATE videos SET views = views + 1 WHERE id = ?', (video_id,))
    conn.commit()
    
    # Add to watch history if logged in
    if current_user.is_authenticated:
        try:
            conn.execute('INSERT INTO watch_history (user_id, video_id) VALUES (?, ?)',
                        (current_user.id, video_id))
            conn.commit()
        except:
            pass
    
    # Get comments
    comments = conn.execute('''
        SELECT c.*, u.username, u.profile_pic
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.video_id = ? AND c.parent_id IS NULL
        ORDER BY c.created_at DESC
    ''', (video_id,)).fetchall()
    
    # Get replies for each comment
    comments_with_replies = []
    for comment in comments:
        replies = conn.execute('''
            SELECT c.*, u.username, u.profile_pic
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.parent_id = ?
            ORDER BY c.created_at ASC
        ''', (comment['id'],)).fetchall()
        comments_with_replies.append({
            'comment': comment,
            'replies': replies
        })
    
    # Get related videos
    related_videos = get_related_videos(video_id, video['category_id'])
    
    # Get like/dislike counts
    likes_count = get_video_likes_count(video_id)
    dislikes_count = get_video_dislikes_count(video_id)
    
    # Check if current user has liked/disliked
    user_like_status = None
    if current_user.is_authenticated:
        like_record = conn.execute('SELECT is_like FROM likes WHERE user_id = ? AND video_id = ?',
                                  (current_user.id, video_id)).fetchone()
        if like_record:
            user_like_status = like_record['is_like']
    
    # Check subscription status
    is_subscribed_to_channel = False
    if current_user.is_authenticated:
        is_subscribed_to_channel = is_subscribed(current_user.id, video['channel_id'])
    
    subscriber_count = get_subscriber_count(video['channel_id'])
    
    conn.close()
    
    return render_template('watch.html', 
                         video=video,
                         comments_with_replies=comments_with_replies,
                         related_videos=related_videos,
                         likes_count=likes_count,
                         dislikes_count=dislikes_count,
                         user_like_status=user_like_status,
                         is_subscribed=is_subscribed_to_channel,
                         subscriber_count=subscriber_count)

@app.route('/add_comment/<int:video_id>', methods=['POST'])
@login_required
def add_comment(video_id):
    """Add comment to video"""
    content = request.form.get('content')
    parent_id = request.form.get('parent_id')
    
    if not content:
        flash('Comment cannot be empty!', 'error')
        return redirect(url_for('watch', video_id=video_id))
    
    conn = get_db()
    try:
        conn.execute('INSERT INTO comments (content, user_id, video_id, parent_id) VALUES (?, ?, ?, ?)',
                    (content, current_user.id, video_id, parent_id if parent_id else None))
        conn.commit()
        
        # Get video owner for notification
        video = conn.execute('SELECT user_id, title FROM videos WHERE id = ?', (video_id,)).fetchone()
        if video and video['user_id'] != current_user.id:
            conn.execute('''
                INSERT INTO notifications (user_id, message)
                VALUES (?, ?)
            ''', (video['user_id'], f"{current_user.username} commented on your video: {video['title']}"))
            conn.commit()
        
        flash('Comment added successfully!', 'success')
    except Exception as e:
        flash('Failed to add comment!', 'error')
    finally:
        conn.close()
    
    return redirect(url_for('watch', video_id=video_id))

@app.route('/delete_comment/<int:comment_id>')
@login_required
def delete_comment(comment_id):
    """Delete comment"""
    conn = get_db()
    comment = conn.execute('SELECT * FROM comments WHERE id = ?', (comment_id,)).fetchone()
    
    if comment and (comment['user_id'] == current_user.id or current_user.is_admin):
        conn.execute('DELETE FROM comments WHERE id = ? OR parent_id = ?', (comment_id, comment_id))
        conn.commit()
        flash('Comment deleted!', 'success')
    else:
        flash('You cannot delete this comment!', 'error')
    
    conn.close()
    return redirect(request.referrer or url_for('home'))

@app.route('/like/<int:video_id>/<action>')
@login_required
def like_video(video_id, action):
    """Like or dislike a video"""
    conn = get_db()
    is_like = 1 if action == 'like' else 0
    
    try:
        # Check if user already has a like/dislike record
        existing = conn.execute('SELECT * FROM likes WHERE user_id = ? AND video_id = ?',
                               (current_user.id, video_id)).fetchone()
        
        if existing:
            if existing['is_like'] == is_like:
                # Remove like/dislike if same action
                conn.execute('DELETE FROM likes WHERE id = ?', (existing['id'],))
            else:
                # Update existing record
                conn.execute('UPDATE likes SET is_like = ? WHERE id = ?', (is_like, existing['id']))
        else:
            # Insert new record
            conn.execute('INSERT INTO likes (user_id, video_id, is_like) VALUES (?, ?, ?)',
                        (current_user.id, video_id, is_like))
        
        conn.commit()
    except Exception as e:
        flash('Error processing like!', 'error')
    finally:
        conn.close()
    
    return redirect(url_for('watch', video_id=video_id))

@app.route('/subscribe/<int:channel_id>')
@login_required
def subscribe(channel_id):
    """Subscribe or unsubscribe from channel"""
    if channel_id == current_user.id:
        flash('You cannot subscribe to yourself!', 'error')
        return redirect(request.referrer or url_for('home'))
    
    conn = get_db()
    try:
        existing = conn.execute('SELECT * FROM subscribers WHERE subscriber_id = ? AND channel_id = ?',
                               (current_user.id, channel_id)).fetchone()
        
        if existing:
            conn.execute('DELETE FROM subscribers WHERE id = ?', (existing['id'],))
            flash('Unsubscribed!', 'success')
        else:
            conn.execute('INSERT INTO subscribers (subscriber_id, channel_id) VALUES (?, ?)',
                        (current_user.id, channel_id))
            
            # Add notification for channel owner
            conn.execute('''
                INSERT INTO notifications (user_id, message)
                VALUES (?, ?)
            ''', (channel_id, f"{current_user.username} subscribed to your channel!"))
            
            flash('Subscribed!', 'success')
        
        conn.commit()
    except Exception as e:
        flash('Error processing subscription!', 'error')
    finally:
        conn.close()
    
    return redirect(request.referrer or url_for('home'))

@app.route('/channel/<int:channel_id>')
def channel(channel_id):
    """Channel page"""
    conn = get_db()
    channel_user = conn.execute('SELECT * FROM users WHERE id = ?', (channel_id,)).fetchone()
    
    if not channel_user:
        flash('Channel not found!', 'error')
        return redirect(url_for('home'))
    
    videos = conn.execute('''
        SELECT v.*, c.name as category_name
        FROM videos v
        LEFT JOIN categories c ON v.category_id = c.id
        WHERE v.user_id = ?
        ORDER BY v.created_at DESC
    ''', (channel_id,)).fetchall()
    
    subscriber_count = get_subscriber_count(channel_id)
    is_subscribed_to = False
    if current_user.is_authenticated:
        is_subscribed_to = is_subscribed(current_user.id, channel_id)
    
    conn.close()
    
    return render_template('channel.html',
                         channel_user=channel_user,
                         videos=videos,
                         subscriber_count=subscriber_count,
                         is_subscribed=is_subscribed_to)

@app.route('/search')
def search():
    """Search videos"""
    query = request.args.get('q', '')
    category = request.args.get('category', '')
    
    conn = get_db()
    sql = '''
        SELECT v.*, u.username as channel_name
        FROM videos v
        JOIN users u ON v.user_id = u.id
        WHERE (v.title LIKE ? OR v.tags LIKE ? OR v.description LIKE ?)
    '''
    params = [f'%{query}%', f'%{query}%', f'%{query}%']
    
    if category:
        sql += ' AND v.category_id = ?'
        params.append(category)
    
    sql += ' ORDER BY v.created_at DESC'
    
    videos = conn.execute(sql, params).fetchall()
    categories = conn.execute('SELECT * FROM categories').fetchall()
    conn.close()
    
    return render_template('search.html', 
                         videos=videos,
                         query=query,
                         categories=categories,
                         selected_category=category)

@app.route('/api/search/suggestions')
def search_suggestions():
    """API endpoint for search suggestions"""
    query = request.args.get('q', '')
    conn = get_db()
    suggestions = conn.execute(
        'SELECT title FROM videos WHERE title LIKE ? LIMIT 5',
        (f'%{query}%',)
    ).fetchall()
    conn.close()
    return jsonify([s['title'] for s in suggestions])

@app.route('/add_to_favorites/<int:video_id>')
@login_required
def add_to_favorites(video_id):
    """Add video to favorites"""
    conn = get_db()
    try:
        existing = conn.execute('SELECT * FROM favorites WHERE user_id = ? AND video_id = ?',
                               (current_user.id, video_id)).fetchone()
        
        if existing:
            conn.execute('DELETE FROM favorites WHERE id = ?', (existing['id'],))
            flash('Removed from favorites!', 'success')
        else:
            conn.execute('INSERT INTO favorites (user_id, video_id) VALUES (?, ?)',
                        (current_user.id, video_id))
            flash('Added to favorites!', 'success')
        
        conn.commit()
    except Exception as e:
        flash('Error!', 'error')
    finally:
        conn.close()
    
    return redirect(request.referrer or url_for('home'))

@app.route('/favorites')
@login_required
def favorites():
    """View favorite videos"""
    conn = get_db()
    videos = conn.execute('''
        SELECT v.*, u.username as channel_name
        FROM favorites f
        JOIN videos v ON f.video_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
    ''', (current_user.id,)).fetchall()
    conn.close()
    return render_template('favorites.html', videos=videos)

@app.route('/history')
@login_required
def history():
    """View watch history"""
    conn = get_db()
    videos = conn.execute('''
        SELECT DISTINCT v.*, u.username as channel_name, MAX(w.watched_at) as last_watched
        FROM watch_history w
        JOIN videos v ON w.video_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE w.user_id = ?
        GROUP BY v.id
        ORDER BY last_watched DESC
    ''', (current_user.id,)).fetchall()
    conn.close()
    return render_template('history.html', videos=videos)

@app.route('/notifications')
@login_required
def notifications():
    """View notifications"""
    conn = get_db()
    user_notifications = conn.execute('''
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ''', (current_user.id,)).fetchall()
    
    # Mark all as read
    conn.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', (current_user.id,))
    conn.commit()
    conn.close()
    
    return render_template('notifications.html', notifications=user_notifications)

@app.route('/admin')
@login_required
@admin_required
def admin_panel():
    """Admin dashboard"""
    conn = get_db()
    
    # Get statistics
    total_users = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    total_videos = conn.execute('SELECT COUNT(*) FROM videos').fetchone()[0]
    total_views = conn.execute('SELECT SUM(views) FROM videos').fetchone()[0] or 0
    total_comments = conn.execute('SELECT COUNT(*) FROM comments').fetchone()[0]
    
    # Get recent data
    recent_videos = conn.execute('''
        SELECT v.*, u.username
        FROM videos v
        JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
        LIMIT 10
    ''').fetchall()
    
    recent_users = conn.execute('SELECT * FROM users ORDER BY created_at DESC LIMIT 10').fetchall()
    
    conn.close()
    
    return render_template('admin.html',
                         total_users=total_users,
                         total_videos=total_videos,
                         total_views=total_views,
                         total_comments=total_comments,
                         recent_videos=recent_videos,
                         recent_users=recent_users)

@app.route('/admin/delete_video/<int:video_id>')
@login_required
@admin_required
def admin_delete_video(video_id):
    """Admin delete video"""
    conn = get_db()
    video = conn.execute('SELECT filename, thumbnail FROM videos WHERE id = ?', (video_id,)).fetchone()
    
    if video:
        # Delete files
        video_path = os.path.join(app.config['UPLOAD_FOLDER'], video['filename'])
        thumbnail_path = os.path.join(app.config['THUMBNAIL_FOLDER'], video['thumbnail'])
        
        if os.path.exists(video_path):
            os.remove(video_path)
        if os.path.exists(thumbnail_path) and video['thumbnail'] != 'default_thumb.jpg':
            os.remove(thumbnail_path)
        
        # Delete from database
        conn.execute('DELETE FROM comments WHERE video_id = ?', (video_id,))
        conn.execute('DELETE FROM likes WHERE video_id = ?', (video_id,))
        conn.execute('DELETE FROM watch_history WHERE video_id = ?', (video_id,))
        conn.execute('DELETE FROM favorites WHERE video_id = ?', (video_id,))
        conn.execute('DELETE FROM videos WHERE id = ?', (video_id,))
        conn.commit()
        flash('Video deleted!', 'success')
    
    conn.close()
    return redirect(url_for('admin_panel'))

@app.route('/admin/delete_user/<int:user_id>')
@login_required
@admin_required
def admin_delete_user(user_id):
    """Admin delete user"""
    if user_id == current_user.id:
        flash('You cannot delete yourself!', 'error')
        return redirect(url_for('admin_panel'))
    
    conn = get_db()
    # Delete all user data
    conn.execute('DELETE FROM comments WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM likes WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM subscribers WHERE subscriber_id = ? OR channel_id = ?', (user_id, user_id))
    conn.execute('DELETE FROM watch_history WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM favorites WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM notifications WHERE user_id = ?', (user_id,))
    
    # Delete user's videos
    videos = conn.execute('SELECT filename, thumbnail FROM videos WHERE user_id = ?', (user_id,)).fetchall()
    for video in videos:
        video_path = os.path.join(app.config['UPLOAD_FOLDER'], video['filename'])
        thumbnail_path = os.path.join(app.config['THUMBNAIL_FOLDER'], video['thumbnail'])
        if os.path.exists(video_path):
            os.remove(video_path)
        if os.path.exists(thumbnail_path) and video['thumbnail'] != 'default_thumb.jpg':
            os.remove(thumbnail_path)
    
    conn.execute('DELETE FROM videos WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    
    flash('User deleted!', 'success')
    return redirect(url_for('admin_panel'))

@app.route('/video/<filename>')
def serve_video(filename):
    """Serve video files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500
@app.route('/api/notifications/count')
@login_required
def notification_count():
    """API endpoint for notification count"""
    conn = get_db()
    count = conn.execute(
        'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0',
        (current_user.id,)
    ).fetchone()[0]
    conn.close()
    return jsonify({'count': count})
# Run the application
if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
