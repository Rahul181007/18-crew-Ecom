# 🛍️ 18-Crew E-Commerce Platform

A full-stack E-Commerce application built with **Node.js**, **Express.js**, **MongoDB**, **EJS**, and **JavaScript**.

The platform provides a complete online shopping experience, allowing customers to browse products, manage carts and wishlists, apply coupons, place orders, make secure payments, track purchases, and earn referral rewards. It also includes a comprehensive admin dashboard for managing products, inventory, offers, banners, customers, orders, and sales analytics.

---

## 🚀 Features

### Authentication & Security

- User Registration with OTP Verification
- OTP Resend Functionality
- User Login & Logout
- Google OAuth Authentication
- Forgot Password & Password Reset
- Session-Based Authentication
- Protected Routes
- Role-Based Access Control
- Secure Password Encryption

### User Account Management

- Profile Management
- Profile Picture Upload
- Change Email with Verification
- Change Password
- Address Management
- Account Deletion

### Referral System

- Unique Referral Codes
- Referral Reward System
- Referral Tracking
- Referral Redemption During Signup

### Product Management

- Browse Products
- Product Details Page
- Product Search
- Search Suggestions
- Category Filtering
- Price Filtering
- Product Availability Tracking

### Cart Management

- Add Products to Cart
- Update Product Quantity
- Remove Products from Cart
- Cart Summary

### Wishlist Management

- Add Products to Wishlist
- Remove Products from Wishlist
- Move Wishlist Items to Cart

### Checkout & Orders

- Address Selection
- Stock Validation Before Checkout
- Order Placement
- Order History
- Order Tracking
- Order Cancellation
- Item-Level Order Cancellation
- Return Requests
- Invoice Download

### Coupon & Offer System

- Coupon Application
- Coupon Removal
- Product Offers
- Category Offers
- Discount Management

### Payment System

- Secure Payment Gateway Integration
- Online Payment Processing
- Payment Verification
- Failed Payment Retry
- Order Confirmation

### Inventory Management

- Real-Time Stock Tracking
- Inventory Updates on Purchase
- Product Availability Control
- Stock Management

### Admin Dashboard

- Dashboard Analytics
- Sales Reports
- Downloadable Reports
- Best Selling Products
- Best Selling Categories
- Best Selling Brands
- Customer Management
- Product Management
- Category Management
- Brand Management
- Banner Management
- Coupon Management
- Inventory Monitoring
- Order Management

---

## 🛠️ Tech Stack

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose

### Frontend

- EJS
- HTML5
- CSS3
- JavaScript

### Authentication

- Passport.js
- Google OAuth
- Express Session

### Payments

- Razorpay Payment Gateway

### Architecture

- MVC Architecture
- Middleware-Based Request Handling

---

## 📂 Project Structure

```text
18-crew-ecom/
│
├── config/
├── constants/
├── controllers/
├── helpers/
├── middlewares/
├── models/
├── public/
├── routes/
├── utils/
├── views/
│
├── server.js
├── package.json
├── package-lock.json
└── README.md
```

---

## 🔐 Authentication Flow

### Registration

```text
User Registration
        ↓
OTP Verification
        ↓
Password Encryption
        ↓
Store User in Database
```

### Login

```text
User Login
      ↓
Credential Validation
      ↓
Session Creation
      ↓
Authenticated User Access
```

### Google Authentication

```text
User Clicks Google Login
          ↓
Google OAuth Consent
          ↓
Verify User Details
          ↓
Create/Login User
          ↓
Redirect to Dashboard
```

---

## 🎁 Referral Flow

```text
User Shares Referral Code
            ↓
New User Registers
            ↓
Referral Code Applied
            ↓
Reward Generated
            ↓
Referral Tracked
```

---

## 🛍️ Shopping Flow

```text
Browse Products
        ↓
Search / Filter Products
        ↓
View Product Details
        ↓
Add to Cart / Wishlist
        ↓
Apply Coupon
        ↓
Proceed to Checkout
        ↓
Select Address
        ↓
Complete Payment
        ↓
Place Order
        ↓
Track Order Status
```

---

## ❤️ Wishlist Flow

```text
User Selects Product
          ↓
Add to Wishlist
          ↓
Wishlist Stored
          ↓
View Wishlist
          ↓
Move Item to Cart
```

---

## 📦 Inventory Flow

```text
Product Added by Admin
          ↓
Stock Quantity Assigned
          ↓
Customer Places Order
          ↓
Inventory Updated
          ↓
Stock Availability Reflected
```

---

## 💳 Payment Flow

```text
Checkout
    ↓
Apply Coupon
    ↓
Payment Gateway
    ↓
Payment Verification
    ↓
Order Creation
    ↓
Confirmation
```

---

## 📊 Admin Dashboard

```text
Admin Login
      ↓
Dashboard Analytics
      ↓
Manage Products
      ↓
Manage Inventory
      ↓
Manage Orders
      ↓
Manage Coupons & Offers
      ↓
Generate Sales Reports
```

---

## 📌 Core Modules

### User Module

- Registration
- Login
- Profile Management
- Address Management
- Referral System

### Product Module

- Product Listing
- Product Details
- Category Filtering
- Search & Suggestions

### Cart Module

- Add to Cart
- Update Cart
- Remove Products

### Wishlist Module

- Add Wishlist Item
- Remove Wishlist Item
- Move to Cart

### Order Module

- Create Orders
- Order History
- Order Tracking
- Returns & Cancellations
- Invoice Generation

### Coupon Module

- Apply Coupons
- Remove Coupons
- Discount Calculation

### Inventory Module

- Stock Management
- Inventory Updates
- Product Availability

### Payment Module

- Razorpay Integration
- Payment Verification
- Retry Failed Payments

### Admin Module

- Product Management
- Inventory Control
- Banner Management
- Coupon Management
- Order Management
- User Management
- Sales Analytics

---

## ⚙️ Setup Instructions

### Clone Repository

```bash
git clone <repository-url>
cd 18-crew-ecom
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000

MONGODB_URI=

SESSION_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

### Start Development Server

```bash
npm start
```

---

## 🧪 Testing Checklist

### Authentication

- [x] Registration with OTP
- [x] Login & Logout
- [x] Forgot Password
- [x] Google Authentication
- [x] Protected Routes

### Shopping Features

- [x] Product Browsing
- [x] Search & Suggestions
- [x] Category Filtering
- [x] Price Filtering
- [x] Cart Management

### Wishlist

- [x] Add to Wishlist
- [x] Remove from Wishlist
- [x] Move to Cart

### Orders & Payments

- [x] Checkout Flow
- [x] Payment Processing
- [x] Payment Verification
- [x] Retry Failed Payments
- [x] Order Creation
- [x] Order Tracking
- [x] Order Cancellation
- [x] Return Requests

### Coupons & Offers

- [x] Coupon Application
- [x] Coupon Removal
- [x] Product Offers
- [x] Category Offers

### Inventory

- [x] Stock Tracking
- [x] Inventory Updates
- [x] Product Availability

### Admin

- [x] Product Management
- [x] Category Management
- [x] Brand Management
- [x] Banner Management
- [x] Coupon Management
- [x] Inventory Management
- [x] Order Management
- [x] Sales Reports

---

## 📸 User Journey

```text
Register/Login
      ↓
Browse Products
      ↓
Search & Filter
      ↓
Add to Cart/Wishlist
      ↓
Apply Coupon
      ↓
Checkout
      ↓
Payment
      ↓
Order Confirmation
      ↓
Track Order
      ↓
Download Invoice
```

---

## 👨‍💻 Author

**Rahul R**

---
