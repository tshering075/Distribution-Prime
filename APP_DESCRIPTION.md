# Coke Calculator & Dashboard - Application Description

## 🎯 **PURPOSE OF THE APPLICATION**

This is a **Sales Management and Order Processing System** for Coca-Cola distributors. The app helps manage:
- **Distributor Management**: Register and manage multiple distributors across different regions
- **Target Setting**: Set sales targets (PC - Cases, UC - Unit Cases) for distributors
- **Progress Tracking**: Monitor distributor performance against targets
- **Order Processing**: Calculate and process orders from distributors
- **Data Analysis**: Upload and analyze sales data from Excel files

---

## 👥 **USER ROLES**

### 1. **Admin User**
- Manages all distributors
- Sets sales targets
- Uploads and analyzes sales data
- Views regional performance
- Manages target periods

### 2. **Distributor User**
- Views their own targets and achievements
- Places orders using the calculator
- Tracks their progress
- Views order history

---

## 🔄 **APPLICATION WORKFLOW**

### **Initial Setup (Admin)**

1. **Login as Admin**
   - Username: `admin`
   - Password: `1234` (default, can be changed)
   - Admin credentials are stored securely in localStorage

2. **Register Distributors**
   - Go to "Distributors" menu
   - Add distributor details:
     - Name, Code, Region (South/West/East/PLING/THIM)
     - Username and Password (for distributor login)
     - Email and Address
   - Each distributor gets unique credentials

3. **Set Targets**
   - Go to "Targets" menu
   - Set target period (start and end dates)
   - For each distributor, set targets:
     - **CSD (Carbonated Soft Drinks)**: PC (Cases) and UC (Unit Cases)
     - **Water (Kinley)**: PC (Cases) and UC (Unit Cases)
   - Targets can be set by region or individually

4. **Upload Sales Data**
   - Upload Excel file (.xlsx or .xls)
   - App parses the file and extracts:
     - Achieved sales (PC and UC)
     - Updates distributor achievements
   - View data in "Sales Data Preview" table
   - Filter by region or view all

### **Daily Operations (Distributor)**

1. **Login as Distributor**
   - Use username and password provided by admin
   - Dashboard shows:
     - Target balance (remaining to achieve)
     - Target period dates
     - Days remaining
     - Progress tracker (CSD and Water)

2. **Place Orders**
   - Click "Place Order" in sidebar
   - Calculator opens with product list:
     - **CSD Products**: Coca Cola, Fanta, Sprite, Charge (various sizes)
     - **Water Products**: Kinley (various sizes)
     - **CAN Products**: Various canned beverages
   - Enter number of cases for each product
   - Click "Calculate" to see:
     - Total cases (PC)
     - Total amount (₹)
     - Total weight (tons)
     - Total UC (Unit Cases)
   - Click "Place Order" to submit
   - Order gets saved with order number and timestamp

3. **Track Progress**
   - View progress cards showing:
     - Target vs Achieved
     - Balance (remaining)
     - Percentage completion
   - Circular progress indicators on mobile
   - Overall progress bar

### **Monitoring (Admin)**

1. **View Regional Performance**
   - Filter by region (All, South, West, East, PLING, THIM)
   - See target balance for selected region
   - View distributor counts per region

2. **Analyze Sales Data**
   - Upload Excel files with sales reports
   - Preview data in table format
   - Filter by region
   - Download processed data

3. **Manage Targets**
   - Update targets for distributors
   - Set target periods
   - View target vs achieved vs balance

---

## 📊 **KEY METRICS & TERMINOLOGY**

### **PC (Cases)**
- Physical cases of products
- Example: 100 cases of Coca Cola 500ml

### **UC (Unit Cases)**
- Calculated unit for tracking
- Formula varies by product:
  - CSD: `(cases × multiplier) / 5.678`
  - Water: `(cases × multiplier) / 5.678`
  - Cans: No UC calculation

### **Target Balance**
- Remaining quantity to achieve target
- Formula: `Target - Achieved = Balance`

### **Regions**
- **South** (Southern)
- **West** (Western)
- **East** (Eastern)
- **PLING**
- **THIM**

---

## 🧮 **CALCULATOR FUNCTIONALITY**

### **How It Works:**

1. **Product Selection**
   - Distributor selects products and enters case quantities
   - Products are categorized: CSD, Water, Cans

2. **Automatic Calculations**
   - **Total Cases (PC)**: Sum of all cases entered
   - **Total Amount**: `Cases × Rate per case`
   - **Total Tons**: `(Cases × kg per case) / 1000`
   - **Total UC**: Calculated using product-specific formulas

3. **Order Summary**
   - Shows quick summary (Cases, Amount, Tons, UC)
   - Detailed breakdown table
   - CSD UC and Water UC separated
   - Order number generated sequentially

4. **Order Submission**
   - Order saved with timestamp
   - Appears in distributor's order history
   - Can be viewed later

---

## 📁 **DATA STORAGE**

All data is stored in **localStorage** (browser storage):

- **Distributors**: List of all registered distributors
- **Targets**: Sales targets for each distributor
- **Achievements**: Achieved sales data
- **Orders**: Order history for distributors
- **Target Period**: Current target period dates
- **Admin Credentials**: Admin login information

**Note**: Data persists in browser but is local to each device/browser.

---

## 🎨 **KEY FEATURES**

### **For Admin:**
✅ Register/Edit/Delete distributors  
✅ Set and update sales targets  
✅ Upload Excel sales data  
✅ View regional performance  
✅ Filter by region  
✅ Download reports  
✅ Manage target periods  

### **For Distributor:**
✅ View personal targets and achievements  
✅ Track progress with visual indicators  
✅ Place orders using calculator  
✅ View order history  
✅ See remaining balance to achieve targets  
✅ Monitor days remaining in target period  

---

## 📱 **MOBILE-FIRST DESIGN**

The app is optimized for mobile devices:
- Touch-friendly buttons and inputs
- Responsive layouts (adapts to screen size)
- Mobile-optimized navigation
- Card-based views on mobile
- Table views on desktop
- Easy-to-use calculator interface

---

## 🔐 **SECURITY FEATURES**

- Password hashing (passwords not stored in plain text)
- Secure authentication system
- Role-based access (Admin vs Distributor)
- Input validation
- Error handling

---

## 💼 **BUSINESS USE CASE**

### **Scenario:**
A Coca-Cola distribution company wants to:
1. Manage multiple distributors across regions
2. Set monthly/periodic sales targets
3. Track distributor performance
4. Process orders from distributors
5. Analyze sales data from Excel reports

### **Benefits:**
- ✅ Centralized distributor management
- ✅ Real-time progress tracking
- ✅ Easy order processing
- ✅ Data analysis and reporting
- ✅ Mobile-friendly for field use
- ✅ No backend required (works offline)

---

## 🚀 **TYPICAL WORKFLOW EXAMPLE**

### **Month Start (Admin):**
1. Admin logs in
2. Sets target period (e.g., Oct 1 - Oct 31, 2025)
3. Sets targets for all distributors:
   - Distributor A: CSD UC 5000, Water UC 2000
   - Distributor B: CSD UC 3000, Water UC 1500
   - etc.

### **During Month (Distributor):**
1. Distributor logs in daily
2. Views progress: "I've achieved 60% of my target"
3. Places orders as needed using calculator
4. Tracks remaining balance

### **Month End (Admin):**
1. Admin uploads Excel file with actual sales data
2. System updates achievements for all distributors
3. Admin views regional performance
4. Sees which distributors met/exceeded targets
5. Downloads report for management

---

## 📈 **REPORTING & ANALYTICS**

- **Target Balance**: Shows remaining to achieve
- **Progress Percentage**: Visual indicators
- **Regional Comparison**: Filter by region
- **Excel Integration**: Upload/download data
- **Order History**: Track all orders
- **Time-based Tracking**: Days remaining counter

---

## 🎯 **SUMMARY**

This app is a **complete sales management solution** for Coca-Cola distribution, allowing:
- **Admin** to manage distributors, set targets, and analyze performance
- **Distributors** to place orders and track their progress
- **Both** to work efficiently on mobile devices in the field

The app replaces manual Excel tracking with an automated, user-friendly system that works on any device with a web browser.
