import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register({ name, email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          Create account
        </div>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              type="password"
            />
          </div>
          {error ? <div style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</div> : null}
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Register"}
          </button>
          <div className="muted" style={{ fontSize: 12 }}>
            Already have an account?{" "}
            <a href="/login" style={{ fontWeight: 900 }}>
              Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

