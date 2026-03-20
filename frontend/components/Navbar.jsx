import React from "react";
import { Link, NavLink } from "react-router-dom";

export default function Navbar({ theme, onToggleTheme, onLogout }) {
  return (
    <div className="navbar">
      <div className="nav-inner">
        <div className="pill">
          <Link to="/dashboard" style={{ fontWeight: 900 }}>
            SmartSpend AI
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NavLink to="/dashboard" className="muted" style={{ padding: "8px 10px", borderRadius: 999 }}>
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className="muted" style={{ padding: "8px 10px", borderRadius: 999 }}>
            Transactions
          </NavLink>
          <NavLink to="/budget-goals" className="muted" style={{ padding: "8px 10px", borderRadius: 999 }}>
            Goals & Budgets
          </NavLink>

          <button type="button" onClick={onToggleTheme} className="pill" style={{ cursor: "pointer" }}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" onClick={onLogout} className="danger">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

