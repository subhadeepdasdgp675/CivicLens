# CivicLens — Test Credentials & Login Information

## 1. Fast One-Click Admin Access
On the Login screen ([http://localhost:8080/login](http://localhost:8080/login)), click the **"Login as Admin (1-Click)"** button to instantly enter the Municipal Command Dashboard without needing OTP or credentials.

---

## 2. OTP-Based Login (Email OTP)
Select the **"Email OTP Login"** tab on the Login page:
1. Enter your registered email (e.g. `citizen@civiclens.in` or your registered personal email).
2. Click **"Send OTP"**.
3. The 6-digit OTP is delivered via Gmail SMTP (`lensecivic@gmail.com`).
4. If testing locally or offline, the OTP is also printed in the backend console log:
   ```
   ======================================================
   [LOCAL DEV OTP] Email: citizen@civiclens.in
   [LOCAL DEV OTP] OTP Code: 137893 (login)
   ======================================================
   ```
5. Enter or paste the 6-digit OTP into the boxes and click **"Verify & Log In"**.

---

## 3. Demo Accounts (Password Login)
Default password for all demo accounts: `password123`

| Role | Email | Password | Dashboard |
| :--- | :--- | :--- | :--- |
| **Citizen** | `citizen@civiclens.in` | `password123` | Citizen Dashboard |
| **Municipal Admin** | `admin@pmc.gov.in` | `password123` | Municipal Command Centre |
| **Sanitation Dept** | `sanitation@pune.gov.in` | `password123` | Department Queue |
| **Roads & Infra Dept** | `roads@pune.gov.in` | `password123` | Department Queue |
| **Water Supply Dept** | `water@pune.gov.in` | `password123` | Department Queue |
| **Electrical Dept** | `electrical@pune.gov.in` | `password123` | Department Queue |
| **Drainage Dept** | `drainage@pune.gov.in` | `password123` | Department Queue |
| **Footpath Dept** | `footpath@pune.gov.in` | `password123` | Department Queue |
