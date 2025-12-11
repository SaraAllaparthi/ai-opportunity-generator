-- Create test_users table
CREATE TABLE IF NOT EXISTS test_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- Insert test data
INSERT INTO test_users (id, name) VALUES (1, 'Test User 1') ON CONFLICT (id) DO NOTHING;
