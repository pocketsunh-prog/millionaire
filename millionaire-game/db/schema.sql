CREATE DATABASE IF NOT EXISTS millionaire;
USE millionaire;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    question TEXT NOT NULL,
    option_a VARCHAR(500) NOT NULL,
    option_b VARCHAR(500) NOT NULL,
    option_c VARCHAR(500) NOT NULL,
    option_d VARCHAR(500) NOT NULL,
    correct_answer ENUM('A', 'B', 'C', 'D') NOT NULL,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_category (category_id),
    INDEX idx_difficulty (difficulty)
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(10) DEFAULT '🎮',
    role ENUM('user', 'admin') DEFAULT 'user',
    total_games INT DEFAULT 0,
    total_wins INT DEFAULT 0,
    best_score INT DEFAULT 0,
    best_question INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_best_score (best_score DESC),
    INDEX idx_role (role)
);

CREATE TABLE IF NOT EXISTS game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    player_name VARCHAR(100),
    score INT DEFAULT 0,
    current_question INT DEFAULT 0,
    lifelines_used JSON,
    status ENUM('active', 'won', 'lost', 'quit') DEFAULT 'active',
    category_played VARCHAR(100),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_score (score DESC)
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token)
);

INSERT IGNORE INTO categories (name, description) VALUES
('Science', 'Physics, Chemistry, Biology, and general science'),
('History', 'World history, historical events, and figures'),
('Geography', 'Countries, capitals, landmarks, and geography'),
('Entertainment', 'Movies, music, TV shows, and pop culture'),
('Sports', 'Various sports, athletes, and sporting events'),
('Technology', 'Computers, internet, inventions, and tech'),
('Literature', 'Books, authors, and literary works'),
('General Knowledge', 'Miscellaneous facts and trivia'),
('Chinese', 'HK DSE Chinese language, literature, and culture'),
('English', 'HK DSE English language, grammar, and comprehension'),
('Maths', 'HK DSE Mathematics, algebra, geometry, calculus, and statistics'),
('Physics', 'HK DSE Physics, mechanics, waves, electricity, and nuclear'),
('Chemistry', 'HK DSE Chemistry, bonding, acids, organic, and electrochemistry'),
('Biology', 'HK DSE Biology, cell, genetics, ecology, and human physiology'),
('IS', 'HK DSE ICT, programming, networks, database, and digital literacy'),
('Chin History', 'HK DSE Chinese History from ancient to modern China'),
('History', 'HK DSE World History from Renaissance to modern era');
