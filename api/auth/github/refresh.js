// api/auth/github/refresh.js
import { inject } from "@vercel/analytics";

inject();

require("dotenv").config();
const axios = require("axios");

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL);

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
    );
    return res.status(200).end();
  }

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Get fresh GitHub user data with the token
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
      },
    });

    // Get GitHub user emails
    let userEmails = [];
    try {
      const emailsResponse = await axios.get(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `token ${token}`,
          },
        }
      );
      userEmails = emailsResponse.data;
    } catch (emailErr) {
      console.log("Could not fetch emails, might not have the right scope");
    }

    // Find primary email
    const primaryEmail =
      userEmails.find((email) => email.primary)?.email ||
      userEmails[0]?.email ||
      `${userResponse.data.login}@users.noreply.github.com`;

    // Combine user data with email
    const userData = {
      ...userResponse.data,
      email: userResponse.data.email || primaryEmail,
    };

    // Send the user data back to the frontend
    return res.json({
      user: userData,
    });
  } catch (error) {
    console.error(
      "Error refreshing GitHub data:",
      error.response?.data || error.message
    );

    // If token is invalid, tell the client
    if (error.response?.status === 401) {
      return res
        .status(401)
        .json({ error: "GitHub token is invalid or expired" });
    }

    return res.status(500).json({
      error: "Failed to refresh GitHub data",
      details: error.response?.data || error.message,
    });
  }
};
