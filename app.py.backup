import streamlit as st
import sqlite3
from pathlib import Path
import hashlib
from datetime import datetime, date, timedelta

DB_PATH = Path("football_club.db")

# ---------- DB HELPERS ----------

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # Users
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )

    # Events
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            time TEXT,
            is_past INTEGER NOT NULL DEFAULT 0
        );
        """
    )

    # Event media (image URLs or file names)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS event_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            media_url TEXT NOT NULL,
            FOREIGN KEY(event_id) REFERENCES events(id)
        );
        """
    )

    # Event interactions (likes, comments, interest)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS event_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_interested INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(event_id, user_id, is_interested),
            FOREIGN KEY(event_id) REFERENCES events(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS event_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            comment TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(event_id) REFERENCES events(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )

    # Practice availability
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS practice_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_date TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('available','tentative','not_available')),
            created_at TEXT NOT NULL,
            UNIQUE(practice_date, user_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )

    # Forum posts
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS forum_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )

    # Forum likes
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS forum_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(post_id, user_id),
            FOREIGN KEY(post_id) REFERENCES forum_posts(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )

    # Forum comments
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS forum_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            comment TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(post_id) REFERENCES forum_posts(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )

    conn.commit()
    conn.close()


# ---------- AUTH HELPERS ----------

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def create_user(email: str, full_name: str, password: str) -> bool:
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (email, full_name, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (email.lower().strip(), full_name.strip(), hash_password(password), datetime.utcnow().isoformat()),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def authenticate_user(email: str, password: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM users WHERE email = ?",
        (email.lower().strip(),),
    )
    row = cur.fetchone()
    conn.close()
    if row and verify_password(password, row["password_hash"]):
        return dict(row)
    return None


# ---------- SAMPLE DATA SEED ----------

def seed_sample_data():
    conn = get_connection()
    cur = conn.cursor()

    # Only seed if no events
    cur.execute("SELECT COUNT(*) as c FROM events")
    if cur.fetchone()["c"] == 0:
        sample_events = [
            (
                "Summer Five-a-Side Tournament",
                "Friendly 5-a-side tournament with local teams.",
                (date.today() - timedelta(days=30)).isoformat(),
                "15:00",
                1,
            ),
            (
                "Charity Match vs Rivals FC",
                "Raising funds for the local community center.",
                (date.today() - timedelta(days=10)).isoformat(),
                "16:00",
                1,
            ),
            (
                "Pre-season Training Camp",
                "Intensive fitness and tactics session.",
                (date.today() + timedelta(days=7)).isoformat(),
                "10:00",
                0,
            ),
            (
                "League Opener Home Game",
                "First league fixture of the new season.",
                (date.today() + timedelta(days=21)).isoformat(),
                "14:30",
                0,
            ),
        ]
        cur.executemany(
            "INSERT INTO events (title, description, date, time, is_past) VALUES (?, ?, ?, ?, ?)",
            sample_events,
        )

    conn.commit()
    conn.close()


# ---------- UI HELPERS ----------

def show_landing_page():
    st.markdown(
        """
        <style>
        .hero {
            padding: 3rem 1rem;
            border-radius: 1rem;
            background: linear-gradient(120deg, #064e3b, #16a34a);
            color: white;
            position: relative;
            overflow: hidden;
        }
        .hero::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image: url('https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg');
            background-size: cover;
            background-position: center;
            opacity: 0.25;
            z-index: 0;
        }
        .hero-content {
            position: relative;
            z-index: 1;
        }
        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            background-color: rgba(15, 23, 42, 0.7);
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .hero-title {
            font-size: clamp(2.2rem, 4vw, 3rem);
            font-weight: 800;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
        }
        .hero-subtitle {
            font-size: 1.05rem;
            max-width: 40rem;
            opacity: 0.9;
        }
        .hero-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            margin-top: 1.8rem;
        }
        .hero-card {
            background-color: rgba(15, 23, 42, 0.85);
            padding: 1rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(148, 163, 184, 0.4);
            cursor: pointer;
        }
        .hero-card h4 {
            margin: 0 0 0.25rem 0;
            font-size: 0.95rem;
        }
        .hero-card p {
            margin: 0;
            font-size: 0.8rem;
            opacity: 0.85;
        }
        </style>
        <div class="hero">
          <div class="hero-content">
            <div class="hero-badge">Glasgow Bengali Football Club · Est. 2024</div>
            <h1 class="hero-title">Welcome to Glasgow Bengali Football Club</h1>
            <p class="hero-subtitle">A community-driven Bengali football club in Glasgow, bringing players, families, and fans together every week. Check upcoming fixtures, training sessions, and relive our best moments.</p>
            <div class="hero-grid">
              <div class="hero-card" onclick="document.getElementById('home-to-events').click()">
                <h4>Match Centre</h4>
                <p>See past and upcoming fixtures, results, and match highlights.</p>
              </div>
              <div class="hero-card" onclick="document.getElementById('home-to-practice').click()">
                <h4>Training Schedule</h4>
                <p>Track Thursday practice sessions and share your availability.</p>
              </div>
              <div class="hero-card" onclick="document.getElementById('home-to-forum').click()">
                <h4>Club Community</h4>
                <p>Meet the Glasgow Bengali football community, volunteers, and committee behind the club.</p>
              </div>
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("\n")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Registered Players", "32")
    with col2:
        st.metric("Seasons Played", "4")
    with col3:
        st.metric("Community Members", "120+")

    # Hidden navigation buttons for JavaScript clicks
    st.markdown(
        """
        <style>
        .hidden-nav { height: 0; overflow: hidden; padding: 0; margin: 0; }
        </style>
        """,
        unsafe_allow_html=True,
    )
    with st.container():
        st.markdown('<div class="hidden-nav">', unsafe_allow_html=True)
        col_hidden1, col_hidden2, col_hidden3 = st.columns(3)
        with col_hidden1:
            if st.button("Go to Events", key="home-to-events"):
                st.session_state.page = "Events"
                st.rerun()
        with col_hidden2:
            if st.button("Go to Practice", key="home-to-practice"):
                st.session_state.page = "Practice"
                st.rerun()
        with col_hidden3:
            if st.button("Go to Forum", key="home-to-forum"):
                st.session_state.page = "Forum"
                st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)


def events_page(current_user):
    st.subheader("Events")
    tab1, tab2 = st.tabs(["Past Events", "Upcoming Events"])

    conn = get_connection()
    cur = conn.cursor()

    with tab1:
        cur.execute("SELECT * FROM events WHERE is_past = 1 ORDER BY date DESC")
        past_events = cur.fetchall()
        pastel_colors = ["#FFE4E1", "#E6E6FA", "#E0FFF4", "#FFF8DC", "#F0FFF0"]
        if not past_events:
            st.info("No past events yet.")
        for idx, ev in enumerate(past_events):
            bg = pastel_colors[idx % len(pastel_colors)]
            st.markdown(
                f"<div style='background-color:{bg}; padding:1rem; border-radius:0.75rem; margin-bottom:0.75rem; border:1px solid rgba(148,163,184,0.5);'>",
                unsafe_allow_html=True,
            )
            st.markdown(f"### {ev['title']}  ")
            st.markdown(f"**Date:** {ev['date']}  ")
            if ev["description"]:
                st.write(ev["description"])

            if current_user:
                like_col, _, comment_col = st.columns([1, 0.2, 2])
                with like_col:
                    if st.button("Like", key=f"like_past_{ev['id']}"):
                        cur.execute(
                            "INSERT OR IGNORE INTO event_likes (event_id, user_id, is_interested, created_at) VALUES (?, ?, 0, ?)",
                            (ev["id"], current_user["id"], datetime.utcnow().isoformat()),
                        )
                        conn.commit()
                with comment_col:
                    comment = st.text_input("Add a comment", key=f"comment_past_{ev['id']}")
                    if st.button("Post", key=f"post_past_{ev['id']}") and comment.strip():
                        cur.execute(
                            "INSERT INTO event_comments (event_id, user_id, comment, created_at) VALUES (?, ?, ?, ?)",
                            (ev["id"], current_user["id"], comment.strip(), datetime.utcnow().isoformat()),
                        )
                        conn.commit()

            cur.execute("SELECT COUNT(*) as c FROM event_comments WHERE event_id = ?", (ev["id"],))
            c = cur.fetchone()["c"]
            st.caption(f"Comments: {c}")
            st.markdown("</div>", unsafe_allow_html=True)

    with tab2:
        cur.execute("SELECT * FROM events WHERE is_past = 0 ORDER BY date ASC")
        upcoming_events = cur.fetchall()
        pastel_colors_upcoming = ["#E0FFFF", "#FFF0F5", "#F0FFF0", "#FFF5EE", "#F5F5DC"]
        if not upcoming_events:
            st.info("No upcoming events yet.")
        for idx, ev in enumerate(upcoming_events):
            bg = pastel_colors_upcoming[idx % len(pastel_colors_upcoming)]
            st.markdown(
                f"<div style='background-color:{bg}; padding:1rem; border-radius:0.75rem; margin-bottom:0.75rem; border:1px solid rgba(148,163,184,0.5);'>",
                unsafe_allow_html=True,
            )
            st.markdown(f"### {ev['title']}  ")
            st.markdown(f"**Date:** {ev['date']} {ev['time'] or ''}  ")
            if ev["description"]:
                st.write(ev["description"])

            if current_user:
                like_col, interest_col, comment_col = st.columns([1, 1, 2])
                with like_col:
                    if st.button("Like", key=f"like_up_{ev['id']}"):
                        cur.execute(
                            "INSERT OR IGNORE INTO event_likes (event_id, user_id, is_interested, created_at) VALUES (?, ?, 0, ?)",
                            (ev["id"], current_user["id"], datetime.utcnow().isoformat()),
                        )
                        conn.commit()
                with interest_col:
                    if st.button("Interested", key=f"interest_up_{ev['id']}"):
                        cur.execute(
                            "INSERT OR IGNORE INTO event_likes (event_id, user_id, is_interested, created_at) VALUES (?, ?, 1, ?)",
                            (ev["id"], current_user["id"], datetime.utcnow().isoformat()),
                        )
                        conn.commit()
                with comment_col:
                    comment = st.text_input("Add a comment", key=f"comment_up_{ev['id']}")
                    if st.button("Post", key=f"post_up_{ev['id']}") and comment.strip():
                        cur.execute(
                            "INSERT INTO event_comments (event_id, user_id, comment, created_at) VALUES (?, ?, ?, ?)",
                            (ev["id"], current_user["id"], comment.strip(), datetime.utcnow().isoformat()),
                        )
                        conn.commit()

            cur.execute(
                "SELECT COUNT(*) as likes FROM event_likes WHERE event_id = ? AND is_interested = 0",
                (ev["id"],),
            )
            likes = cur.fetchone()["likes"]
            cur.execute(
                "SELECT COUNT(*) as interests FROM event_likes WHERE event_id = ? AND is_interested = 1",
                (ev["id"],),
            )
            interests = cur.fetchone()["interests"]
            cur.execute("SELECT COUNT(*) as c FROM event_comments WHERE event_id = ?", (ev["id"],))
            comments_count = cur.fetchone()["c"]
            st.caption(f"Likes: {likes} · Interested: {interests} · Comments: {comments_count}")
            st.markdown("</div>", unsafe_allow_html=True)

    conn.close()


def practice_page(current_user):
    st.subheader("Practice Schedule")

    today = date.today()
    month_start = today.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    month_end = next_month - timedelta(days=1)

    st.markdown("#### Select a Thursday practice date")

    thursdays = []
    d = month_start
    while d <= month_end:
        if d.weekday() == 3:
            thursdays.append(d)
        d += timedelta(days=1)

    options = {d.strftime("%Y-%m-%d"): d for d in thursdays}
    if not options:
        st.info("No Thursdays found for this month.")
        return

    selected_str = st.selectbox("Practice Thursdays", list(options.keys()))
    selected_date = options[selected_str]

    st.markdown(f"### Practice on {selected_date.strftime('%A %d %B %Y')}")
    st.write("**Location:** Local Glasgow 3G Pitch")
    st.write("**Time:** 19:00 - 21:00")

    conn = get_connection()
    cur = conn.cursor()

    if current_user:
        st.markdown("#### Your availability")
        choice = st.radio(
            "Select your status",
            ["Available", "Tentative", "Not Available"],
            horizontal=True,
        )
        status_map = {
            "Available": "available",
            "Tentative": "tentative",
            "Not Available": "not_available",
        }
        if st.button("Save my response"):
            cur.execute(
                """
                INSERT INTO practice_availability (practice_date, user_id, status, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(practice_date, user_id) DO UPDATE SET status=excluded.status
                """,
                (selected_date.isoformat(), current_user["id"], status_map[choice], datetime.utcnow().isoformat()),
            )
            conn.commit()
            st.success("Your availability has been updated.")
    else:
        st.info("Login to record your availability.")

    st.markdown("#### Squad availability for this date")

    col_a, col_t, col_n, col_u = st.columns(4)

    cur.execute("SELECT id, full_name FROM users ORDER BY full_name")
    users = cur.fetchall()

    cur.execute(
        "SELECT user_id, status FROM practice_availability WHERE practice_date = ?",
        (selected_date.isoformat(),),
    )
    status_rows = cur.fetchall()
    status_map_db = {r["user_id"]: r["status"] for r in status_rows}

    available_names = []
    tentative_names = []
    not_available_names = []
    no_vote_names = []

    for u in users:
        st_value = status_map_db.get(u["id"])
        if st_value == "available":
            available_names.append(u["full_name"])
        elif st_value == "tentative":
            tentative_names.append(u["full_name"])
        elif st_value == "not_available":
            not_available_names.append(u["full_name"])
        else:
            no_vote_names.append(u["full_name"])

    def render_list(col, title, names):
        with col:
            st.markdown(f"**{title}**")
            if names:
                for n in names:
                    st.write("- " + n)
            else:
                st.caption("No responses")

    render_list(col_a, "Available", available_names)
    render_list(col_t, "Tentative", tentative_names)
    render_list(col_n, "Not Available", not_available_names)
    render_list(col_u, "No Vote", no_vote_names)

    conn.close()


def about_page():
    st.subheader("About Glasgow Bengali Football Club")

    st.markdown(
        """
Glasgow Bengali Football Club (GBFC) is a community club based in Glasgow,
created to bring together the local Bengali community through football.

We welcome players of all ages and abilities – from complete beginners to
experienced players – and focus on enjoyment, fitness, and friendship both
on and off the pitch.
        """
    )

    st.markdown("### Our Story")
    st.markdown(
        """
Founded in 2024 by a small group of Bengali football fans in Glasgow,
GBFC started as a weekly kick‑about in the local park.
Today we run regular training sessions, friendly matches, and community
events for players, families, and supporters.
        """
    )

    st.markdown("### Our Values")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("**Community**")
        st.caption("Building strong connections within the Glasgow Bengali community.")
    with col2:
        st.markdown("**Respect**")
        st.caption("Respect for teammates, opponents, officials, and the game.")
    with col3:
        st.markdown("**Enjoyment**")
        st.caption("Keeping football fun, inclusive, and welcoming for everyone.")

    st.markdown("### Committee")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.image(
            "https://images.pexels.com/photos/15094615/pexels-photo-15094615/free-photo-of-young-man-wearing-jersey.jpeg",
            caption="Rahul Ahmed – Club Chair",
        )
        st.caption("Leads the club, partnerships, and long‑term vision.")
    with c2:
        st.image(
            "https://images.pexels.com/photos/61135/pexels-photo-61135.jpeg",
            caption="Mina Chowdhury – Head Coach",
        )
        st.caption("Plans training, team selection, and match‑day tactics.")
    with c3:
        st.image(
            "https://images.pexels.com/photos/3755440/pexels-photo-3755440.jpeg",
            caption="Sajid Karim – Secretary",
        )
        st.caption("Handles fixtures, communication, and club admin.")

    st.markdown("### Teams & Members")
    st.markdown(
        """
We currently run:
- **Senior Team** – Competitive friendlies and local tournaments  
- **Social Football** – Casual 5/7‑a‑side sessions  
- **Youth & Family Sessions** – Family‑friendly kick‑abouts and events
        """
    )

    cols = st.columns(4)
    sample_members = [
        ("Arif", "Goalkeeper"),
        ("Nadia", "Defender"),
        ("Imran", "Midfielder"),
        ("Sara", "Forward"),
        ("Kamal", "Wing"),
        ("Tania", "Midfielder"),
        ("Fahim", "Defender"),
        ("Rumi", "Forward"),
    ]
    for i, (name, role) in enumerate(sample_members):
        with cols[i % 4]:
            st.markdown(f"**{name}**")
            st.caption(role)

    st.markdown("### Join Us")
    st.markdown(
        """
If you’d like to train, play, or volunteer with Glasgow Bengali Football Club,
we’d love to hear from you.

**Training night:** Thursdays  
**Typical time:** 19:00 – 21:00 (check the Practice page for details)

You can create an account on this site to see events and training,
or contact a committee member for more information.
        """
    )


def forum_page(current_user):
    st.subheader("Club Forum")

    if not current_user:
        st.info("Please log in to create posts and interact in the forum.")
    else:
        st.markdown("### Create a new post")
        content = st.text_area(
            "Share an update, match story, or announcement (Markdown supported)",
            key="forum_new_content",
            height=150,
        )
        uploaded_image = st.file_uploader(
            "Attach an image (optional)",
            type=["png", "jpg", "jpeg", "webp"],
            key="forum_new_image",
        )

        if content.strip():
            with st.expander("Preview post"):
                st.markdown(content)

        if st.button("Post", key="forum_create_post"):
            if not content.strip():
                st.error("Post text cannot be empty.")
            else:
                image_path_str = None
                if uploaded_image is not None:
                    uploads_dir = Path("uploads")
                    uploads_dir.mkdir(exist_ok=True)
                    file_path = uploads_dir / f"forum_{int(datetime.utcnow().timestamp())}_{uploaded_image.name}"
                    with open(file_path, "wb") as f:
                        f.write(uploaded_image.getbuffer())
                    image_path_str = str(file_path)

                conn = get_connection()
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO forum_posts (user_id, content, image_url, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (current_user["id"], content.strip(), image_path_str, datetime.utcnow().isoformat()),
                )
                conn.commit()
                conn.close()
                st.success("Your post has been published.")
                st.rerun()

    st.markdown("---")
    st.markdown("### Recent posts")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT p.id, p.user_id, p.content, p.image_url, p.created_at, u.full_name
        FROM forum_posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        """
    )
    posts = cur.fetchall()

    if not posts:
        st.info("No forum posts yet. Be the first to share something!")
        conn.close()
        return

    for post in posts:
        post_id = post["id"]
        post_user_id = post["user_id"]
        with st.container(border=True):
            st.markdown(f"**{post['full_name']}**  ·  {post['created_at'][:16].replace('T', ' ')}")
            st.write(post["content"])

            if post["image_url"]:
                st.image(post["image_url"], use_column_width=True)

            # Like & comment row
            like_col, comment_col = st.columns([1, 3])

            if current_user:
                with like_col:
                    if st.button("Like", key=f"forum_like_{post_id}"):
                        try:
                            cur.execute(
                                """
                                INSERT OR IGNORE INTO forum_likes (post_id, user_id, created_at)
                                VALUES (?, ?, ?)
                                """,
                                (post_id, current_user["id"], datetime.utcnow().isoformat()),
                            )
                            conn.commit()
                        except sqlite3.Error:
                            pass

                with comment_col:
                    comment_text = st.text_input("Add a comment", key=f"forum_comment_{post_id}")
                    if st.button("Post comment", key=f"forum_comment_btn_{post_id}") and comment_text.strip():
                        cur.execute(
                            """
                            INSERT INTO forum_comments (post_id, user_id, comment, created_at)
                            VALUES (?, ?, ?, ?)
                            """,
                            (post_id, current_user["id"], comment_text.strip(), datetime.utcnow().isoformat()),
                        )
                        conn.commit()

            # Stats and existing comments
            cur.execute("SELECT COUNT(*) as c FROM forum_likes WHERE post_id = ?", (post_id,))
            likes = cur.fetchone()["c"]
            cur.execute(
                """
                SELECT c.comment, c.created_at, u.full_name
                FROM forum_comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.post_id = ?
                ORDER BY c.created_at ASC
                """,
                (post_id,),
            )
            comments = cur.fetchall()

            st.caption(f"Likes: {likes} · Comments: {len(comments)}")

            with st.expander("View comments"):
                for c in comments:
                    st.markdown(
                        f"**{c['full_name']}**  ·  {c['created_at'][:16].replace('T', ' ')}  \\n {c['comment']}"
                    )

            # Edit / delete controls for the author
            if current_user and current_user["id"] == post_user_id:
                with st.expander("Edit or delete this post"):
                    edit_text = st.text_area(
                        "Edit post text",
                        value=post["content"],
                        key=f"forum_edit_post_{post_id}",
                    )
                    edit_image = st.file_uploader(
                        "Replace image (leave empty to keep current)",
                        type=["png", "jpg", "jpeg", "webp"],
                        key=f"forum_edit_image_{post_id}",
                    )
                    remove_image = st.checkbox(
                        "Remove image",
                        value=False,
                        key=f"forum_remove_image_{post_id}",
                    )

                    col_edit, col_delete = st.columns([1, 1])
                    with col_edit:
                        if st.button("Save changes", key=f"forum_save_post_{post_id}"):
                            if not edit_text.strip():
                                st.error("Post text cannot be empty.")
                            else:
                                new_image_path = post["image_url"]
                                if remove_image:
                                    new_image_path = None
                                elif edit_image is not None:
                                    uploads_dir = Path("uploads")
                                    uploads_dir.mkdir(exist_ok=True)
                                    file_path = uploads_dir / f"forum_{int(datetime.utcnow().timestamp())}_{edit_image.name}"
                                    with open(file_path, "wb") as f:
                                        f.write(edit_image.getbuffer())
                                    new_image_path = str(file_path)

                                cur.execute(
                                    "UPDATE forum_posts SET content = ?, image_url = ? WHERE id = ?",
                                    (edit_text.strip(), new_image_path, post_id),
                                )
                                conn.commit()
                                st.success("Post updated.")
                                st.rerun()
                    with col_delete:
                        if st.button("Delete post", key=f"forum_delete_post_{post_id}"):
                            # Delete related likes and comments first, then the post
                            cur.execute("DELETE FROM forum_comments WHERE post_id = ?", (post_id,))
                            cur.execute("DELETE FROM forum_likes WHERE post_id = ?", (post_id,))
                            cur.execute("DELETE FROM forum_posts WHERE id = ?", (post_id,))
                            conn.commit()
                            st.success("Post deleted.")
                            st.rerun()

    conn.close()


# ---------- MAIN APP ----------

def main():
    st.set_page_config(
        page_title="Glasgow Bengali Football Club",
        page_icon="⚽",
        layout="wide",
    )

    init_db()
    seed_sample_data()

    if "user" not in st.session_state:
        st.session_state.user = None
    if "page" not in st.session_state:
        st.session_state.page = "Home"

    # Top navigation bar
    st.markdown(
        """
        <style>
        .top-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1.5rem;
            background-color: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            flex-wrap: wrap;
        }
        .top-nav .logo {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 700;
            font-size: 1.1rem;
            color: #111827;
        }
        .top-nav .menu {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        /* Style Streamlit buttons inside top-nav */
        .top-nav button[data-testid="baseButton-secondary"] {
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-weight: 500;
            text-align: center;
            transition: background-color 0.2s, color 0.2s;
            border: 1px solid transparent;
        }
        .top-nav button[data-testid="baseButton-secondary"].active {
            background-color: #16a34a !important;
            color: white !important;
            border-color: #16a34a !important;
        }
        .top-nav button[data-testid="baseButton-secondary"]:not(.active) {
            background-color: #f3f4f6 !important;
            color: #111827 !important;
            border-color: #d1d5db !important;
        }
        .top-nav button[data-testid="baseButton-secondary"]:not(.active):hover {
            background-color: #e5e7eb !important;
        }
        .top-nav .auth-section {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    pages = ["Home", "Events", "Practice", "Forum"]
    current_page = st.session_state.get("page", "Home")
    # Build top nav HTML with functional Streamlit buttons
    menu_html = '<div class="top-nav">'
    menu_html += '<div class="logo">⚽ Glasgow Bengali FC</div>'
    menu_html += '<div class="menu">'
    menu_html += '</div>'
    menu_html += '<div class="auth-section">'
    menu_html += '</div>'
    menu_html += '</div>'
    st.markdown(menu_html, unsafe_allow_html=True)
    # Render menu buttons in columns to align horizontally
    cols = st.columns(len(pages))
    for i, p in enumerate(pages):
        is_active = p == current_page
        with cols[i]:
            # Use a custom CSS class to mark active state
            st.markdown(
                f'<style>div[data-testid="stVerticalBlock"] > div > div > button[data-testid="baseButton-secondary"]:nth-of-type({i+1}) {{ {"background-color: #16a34a !important; color: white !important; border-color: #16a34a !important;" if is_active else ""} }}</style>',
                unsafe_allow_html=True,
            )
            if st.button(p, key=f"nav-{p.lower()}", help=f"Go to {p}"):
                st.session_state.page = p
                st.rerun()
    # Auth buttons on the right
    auth_col1, auth_col2 = st.columns(2)
    with auth_col1:
        if st.session_state.user:
            st.markdown(f'<span style="margin-right:0.5rem;">{st.session_state.user["full_name"]}</span>', unsafe_allow_html=True)
        else:
            if st.button("Login", key="login-btn"):
                st.session_state.show_login = True
                st.rerun()
    with auth_col2:
        if st.session_state.user:
            if st.button("Logout", key="logout-btn"):
                st.session_state.user = None
                st.rerun()
        else:
            if st.button("Sign up", key="signup-btn"):
                st.session_state.show_signup = True
                st.rerun()

    # Show login/signup modals if requested
    if st.session_state.get("show_login"):
        with st.expander("Login", expanded=True):
            login_email = st.text_input("Email", key="login_email_modal")
            login_password = st.text_input("Password", type="password", key="login_password_modal")
            if st.button("Log in", key="login_submit_modal"):
                user = authenticate_user(login_email, login_password)
                if user:
                    st.session_state.user = user
                    st.session_state.show_login = False
                    st.success("Logged in successfully.")
                    st.rerun()
                else:
                    st.error("Invalid email or password.")
            if st.button("Cancel", key="login_cancel_modal"):
                st.session_state.show_login = False
                st.rerun()

    if st.session_state.get("show_signup"):
        with st.expander("Sign up", expanded=True):
            signup_name = st.text_input("Full name", key="signup_name_modal")
            signup_email = st.text_input("Email", key="signup_email_modal")
            signup_password = st.text_input("Password", type="password", key="signup_password_modal")
            if st.button("Create account", key="signup_submit_modal"):
                if not signup_name or not signup_email or not signup_password:
                    st.error("Please fill in all fields.")
                else:
                    if create_user(signup_email, signup_name, signup_password):
                        st.session_state.show_signup = False
                        st.success("Account created. You can log in now.")
                        st.rerun()
                    else:
                        st.error("That email is already registered.")
            if st.button("Cancel", key="signup_cancel_modal"):
                st.session_state.show_signup = False
                st.rerun()

    st.markdown("---")
    # Main content routing
    if current_page == "Home":
        show_landing_page()
    elif current_page == "Events":
        events_page(st.session_state.user)
    elif current_page == "Practice":
        practice_page(st.session_state.user)
    elif current_page == "Forum":
        forum_page(st.session_state.user)



if __name__ == "__main__":
    main()