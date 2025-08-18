-- Initial database setup for SkillFi

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance
-- These will be created by Prisma migrations, but listed here for reference

-- Sample data (optional)
-- This can be used for development/testing

-- Skills categories
CREATE TABLE IF NOT EXISTS skill_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO skill_categories (name, description) VALUES
('Web Development', 'Frontend and backend web development skills'),
('Mobile Development', 'iOS, Android, and cross-platform mobile development'),
('Blockchain', 'Smart contracts, DeFi, and Web3 development'),
('Design', 'UI/UX design, graphic design, and visual arts'),
('Data Science', 'Machine learning, data analysis, and AI'),
('DevOps', 'Infrastructure, deployment, and system administration'),
('Marketing', 'Digital marketing, content creation, and SEO'),
('Writing', 'Content writing, copywriting, and technical documentation');

-- Popular skills
CREATE TABLE IF NOT EXISTS popular_skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category_id INTEGER REFERENCES skill_categories(id),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO popular_skills (name, category_id) VALUES
-- Web Development
('JavaScript', 1), ('TypeScript', 1), ('React', 1), ('Vue.js', 1), ('Angular', 1),
('Node.js', 1), ('Python', 1), ('Django', 1), ('Flask', 1), ('PHP', 1),
('Laravel', 1), ('Ruby on Rails', 1), ('HTML/CSS', 1), ('Tailwind CSS', 1),

-- Mobile Development
('React Native', 2), ('Flutter', 2), ('Swift', 2), ('Kotlin', 2), ('Ionic', 2),

-- Blockchain
('Solidity', 3), ('Web3.js', 3), ('Ethers.js', 3), ('Smart Contracts', 3),
('DeFi', 3), ('NFT', 3), ('Hardhat', 3), ('Truffle', 3),

-- Design
('Figma', 4), ('Adobe Photoshop', 4), ('Adobe Illustrator', 4), ('Sketch', 4),
('UI/UX Design', 4), ('Graphic Design', 4), ('Logo Design', 4),

-- Data Science
('Machine Learning', 5), ('Python', 5), ('R', 5), ('TensorFlow', 5),
('PyTorch', 5), ('Data Analysis', 5), ('SQL', 5), ('Pandas', 5),

-- DevOps
('Docker', 6), ('Kubernetes', 6), ('AWS', 6), ('Azure', 6), ('GCP', 6),
('CI/CD', 6), ('Jenkins', 6), ('Terraform', 6), ('Linux', 6),

-- Marketing
('SEO', 7), ('Google Ads', 7), ('Facebook Ads', 7), ('Content Marketing', 7),
('Social Media Marketing', 7), ('Email Marketing', 7),

-- Writing
('Content Writing', 8), ('Copywriting', 8), ('Technical Writing', 8),
('Blog Writing', 8), ('Creative Writing', 8);