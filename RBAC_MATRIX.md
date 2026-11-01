# Role-Based Access Control (RBAC) - Visual Flow

```mermaid
flowchart TD
    %% Section 1: Patient
    subgraph Section1["1. 👤 PATIENT (Archit Singh)"]
        P1["✅ View My Own Medical History"]
        P2["✅ Grant / Revoke Doctor & Hospital Consent"]
        P3["✅ Check Audit Trail (Who Viewed My Data)"]
        P1 --> P2 --> P3
    end

    %% Section 2: Doctor
    subgraph Section2["2. 🩺 ATTENDING DOCTOR (Dr. Rohan Mehta)"]
        D1["🔒 View Patient Chart (Requires Active Consent)"]
        D2["🚨 Emergency Break-Glass (Trauma Override with Reason)"]
        D3["📝 Add New Visits, Prescriptions & Lab Results"]
        D1 --> D2 --> D3
    end

    %% Section 3: Admin
    subgraph Section3["3. 🛡️ CENTRAL ADMINISTRATOR"]
        A1["👥 Merge Duplicate Patient Records (Entity Resolution)"]
        A2["📜 Inspect System-Wide Tamper-Evident Audit Ledger"]
        A3["🚫 Zero Direct Access to Private Medical Records"]
        A1 --> A2 --> A3
    end

    %% Vertical stack flow
    Section1 --> Section2 --> Section3
```

---

### Quick Summary

| Role | Key Permissions | Security Boundary |
|:---|:---|:---|
| **1. 👤 Patient** | View own history, grant/revoke access | Cannot view other patients |
| **2. 🩺 Doctor** | View charts (with consent), add prescriptions, Break-Glass | Blocked without consent or ER override |
| **3. 🛡️ Admin** | Merge duplicate profiles, inspect audit ledger | Cannot view private medical records |
