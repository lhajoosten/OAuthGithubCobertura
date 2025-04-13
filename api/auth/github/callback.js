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

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  try {
    // Exchange code for GitHub access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const { access_token, error } = tokenResponse.data;

    if (error || !access_token) {
      console.error("GitHub token error:", tokenResponse.data);
      return res
        .status(400)
        .json({ error: error || "Failed to get access token" });
    }

    // Get GitHub user data with the token
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    // Get GitHub user emails (if scope includes email)
    let userEmails = [];
    try {
      const emailsResponse = await axios.get(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `token ${access_token}`,
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

    // Send the user data and token back to the frontend
    return res.json({
      user: userData,
      token: access_token,
    });
  } catch (error) {
    console.error(
      "Error during GitHub OAuth:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      error: "Authentication failed",
      details: error.response?.data || error.message,
    });
  }
};
