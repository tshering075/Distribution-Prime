# How to Enable Realtime in Supabase

## 📍 Where to Add the SQL Commands

### **Option 1: Using Supabase SQL Editor (Recommended)**

1. **Go to Supabase Dashboard**
   - Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sign in and select your project

2. **Open SQL Editor**
   - Click on **SQL Editor** in the left sidebar (icon looks like a database with `</>`)
   - Or go to: **Database** → **SQL Editor**

3. **Create a New Query**
   - Click **"New query"** button (top right)
   - Or use the query editor that's already open

4. **Paste the SQL Commands**
   ```sql
   -- Enable Realtime for tables
   ALTER PUBLICATION supabase_realtime ADD TABLE distributors;
   ALTER PUBLICATION supabase_realtime ADD TABLE orders;
   ALTER PUBLICATION supabase_realtime ADD TABLE targets;
   ALTER PUBLICATION supabase_realtime ADD TABLE schemes;
   ALTER PUBLICATION supabase_realtime ADD TABLE sales_data;
   ```

5. **Run the Query**
   - Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
   - You should see "Success. No rows returned" for each command

6. **Verify It Worked**
   - You should see success messages for each table
   - If you get errors, make sure the tables exist first (run the table creation SQL first)

---

### **Option 2: Using Supabase Dashboard UI (Alternative)**

1. **Go to Database → Replication**
   - In Supabase Dashboard, click **Database** in left sidebar
   - Click **Replication** in the submenu

2. **Enable Replication for Each Table**
   - You'll see a list of all your tables
   - Toggle the switch ON for each table:
     - ✅ `distributors`
     - ✅ `orders`
     - ✅ `targets`
     - ✅ `schemes`
     - ✅ `sales_data`

3. **That's it!** The UI method is easier but does the same thing as the SQL commands.

---

## ⚠️ Important Notes

### **Run Table Creation SQL First**
Make sure you've already created the tables before enabling Realtime. If you try to enable Realtime for a table that doesn't exist, you'll get an error.

**Order of operations:**
1. ✅ Create tables (Step 3 in migration guide)
2. ✅ Enable Realtime (this step)
3. ✅ Test your app

### **If You Get Errors**

**Error: "relation does not exist"**
- The table hasn't been created yet
- Go back and run the table creation SQL first

**Error: "publication does not exist"**
- This shouldn't happen, but if it does, try the UI method instead

**Error: "permission denied"**
- Make sure you're using the correct database user
- Try the UI method (Dashboard → Database → Replication)

---

## 🧪 Verify Realtime is Working

After enabling Realtime, you can test it:

1. **Open your app** and log in
2. **Open browser console** (F12)
3. **Make a change** (e.g., update a distributor)
4. **Check console** - you should see real-time updates without refreshing

---

## 📝 Quick Reference

**SQL Editor Location:**
- Dashboard → SQL Editor
- Or: Database → SQL Editor

**UI Method Location:**
- Dashboard → Database → Replication

**Tables to Enable:**
- `distributors`
- `orders`
- `targets`
- `schemes`
- `sales_data`

---

## 🎯 Step-by-Step Visual Guide

### Using SQL Editor:
```
Supabase Dashboard
  └─ SQL Editor (left sidebar)
      └─ New Query button
          └─ Paste SQL commands
              └─ Click Run (or Ctrl+Enter)
```

### Using UI:
```
Supabase Dashboard
  └─ Database (left sidebar)
      └─ Replication
          └─ Toggle switches ON for each table
```
