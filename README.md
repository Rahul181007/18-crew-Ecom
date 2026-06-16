# 🛍️ 18-Crew E-Commerce Platform

A full-stack E-Commerce application built with **Node.js**, **Express.js**, **MongoDB**, **EJS**, and **JavaScript**.

The platform provides a complete online shopping experience, allowing customers to browse products, manage their carts and wishlists, place orders, make secure payments, and track purchases. It also includes an administrative dashboard for managing products, inventory, customers, and orders.

---

## 🚀 Features

### Authentication

- User Registration
- User Login & Logout
- Google OAuth Authentication
- Session-Based Authentication
- Password Encryption
- Protected Routes
- Role-Based Access Control
- Authentication Persistence

### Product Management

- Browse Products
- Product Details Page
- Category-Based Filtering
- Product Search
- Product Availability Tracking
- Dynamic Product Rendering

### Cart Management

- Add Products to Cart
- Update Product Quantity
- Remove Products from Cart
- Cart Summary & Checkout

### Wishlist Management

- Add Products to Wishlist
- Remove Products from Wishlist
- Move Wishlist Items to Cart

### Order Management

- Place Orders
- View Order History
- Order Details Page
- Order Status Tracking

### Payment System

- Secure Payment Gateway Integration
- Online Payment Processing
- Payment Verification
- Order Confirmation

### Inventory Management

- Real-Time Stock Tracking
- Inventory Updates on Purchase
- Product Availability Control
- Stock Management

### Admin Features

- Admin Authentication
- Product Management
- Category Management
- Order Management
- Customer Management
- Inventory Monitoring
- Dashboard Analytics

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

- Payment Gateway Integration

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
Input Validation
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

### Protected Routes

```text
User Request
      ↓
Authentication Middleware
      ↓
Authorized Access
```

---

## 🛍️ Shopping Flow

```text
Browse Products
        ↓
View Product Details
        ↓
Add to Cart / Wishlist
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
Payment Gateway
    ↓
Payment Verification
    ↓
Order Creation
    ↓
Confirmation
```

---

## 📌 Core Modules

### User Module

- Registration
- Login
- Profile Management
- Address Management

### Product Module

- Product Listing
- Product Details
- Category Filtering
- Search Functionality

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

### Inventory Module

- Stock Management
- Inventory Updates
- Product Availability

### Payment Module

- Payment Processing
- Verification
- Order Confirmation

### Admin Module

- Product Management
- Inventory Control
- Order Management
- User Management

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

PAYMENT_GATEWAY_KEY=
PAYMENT_GATEWAY_SECRET=
```

### Start Development Server

```bash
npm start
```

---

## 🧪 Testing Checklist

### Authentication

- [x] User Registration
- [x] User Login
- [x] User Logout
- [x] Google Authentication
- [x] Protected Routes

### Shopping Features

- [x] Product Browsing
- [x] Product Search
- [x] Category Filtering
- [x] Cart Management

### Wishlist

- [x] Add to Wishlist
- [x] Remove from Wishlist
- [x] Move to Cart

### Orders & Payments

- [x] Checkout Flow
- [x] Payment Processing
- [x] Order Creation
- [x] Order Tracking

### Inventory

- [x] Stock Tracking
- [x] Inventory Updates
- [x] Product Availability

### Admin

- [x] Product Management
- [x] Category Management
- [x] Inventory Management
- [x] Order Management

---

## 📸 User Journey

```text
Register/Login
      ↓
Browse Products
      ↓
View Product Details
      ↓
Add to Cart or Wishlist
      ↓
Checkout
      ↓
Complete Payment
      ↓
Order Confirmation
      ↓
Track Orders
```

---

## 🤖 AI Assistance Disclosure

This project was developed with assistance from ChatGPT.

ChatGPT was used for:

- System Design Discussions
- Authentication Flow Guidance
- MVC Architecture Planning
- Database Modeling Discussions
- Payment Integration Guidance
- Debugging Assistance
- Refactoring Suggestions
- Code Review Support

All implementation, testing, debugging, and final technical decisions were performed manually.

---

## 👨‍💻 Author

**Rahul R**

---
