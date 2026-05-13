-- Create application user with limited privileges
CREATE USER ecapp WITH PASSWORD 'ecapppassword';

-- Grant privileges on the database
GRANT ALL PRIVILEGES ON DATABASE ecommerce TO ecapp;

-- Connect to the database
\c ecommerce;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO ecapp;
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO ecapp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ecapp;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO ecapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO ecapp;
