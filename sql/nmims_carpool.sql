CREATE DATABASE IF NOT EXISTS nmims_carpool;
USE nmims_carpool;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  user_type ENUM('student','teacher') NOT NULL,
  city ENUM('Chandigarh','Panchkula','Zirakpur') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rider_id INT NOT NULL,
  pickup_city ENUM('Chandigarh','Panchkula','Zirakpur') NOT NULL,
  pickup_point VARCHAR(180) NOT NULL,
  ride_date DATE NOT NULL,
  ride_time TIME NOT NULL,
  total_seats INT NOT NULL CHECK (total_seats >= 1),
  available_seats INT NOT NULL,
  status ENUM('active','off','full') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ride_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ride_id INT NOT NULL,
  requester_id INT NOT NULL,
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_ride_request (ride_id, requester_id),
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);