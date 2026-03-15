# Email Configuration for Forgot Password Feature

## Quick Start - Enable the Feature

**The forgot password feature is currently HIDDEN but fully implemented.**

### To Enable (3 Simple Steps):

1. **Configure Email** (see sections below for your email provider)
2. **Enable the Button** in `/frontend/src/pages/Login.jsx`:
   - Find line 167: `{false && (`
   - Change to: `{true && (`
3. **Done!** The white "Forgot Password?" button will appear below the login button

---

## Overview
The forgot password feature sends an email to users who have forgotten their password. Since passwords are hashed for security, the email informs users to contact the administrator for password reset.

## Important Security Note
⚠️ **Passwords are hashed and cannot be retrieved**. The current implementation sends an email informing users to contact the administrator. This is the secure approach.

## Email Service Configuration

### Required Environment Variables

Set these environment variables to enable email functionality:

```bash
# SMTP Server Configuration
SMTP_SERVER=smtp.gmail.com          # Default: smtp.gmail.com
SMTP_PORT=587                        # Default: 587 (TLS)
SMTP_USERNAME=your-email@gmail.com   # Your email address
SMTP_PASSWORD=your-app-password      # App password (NOT your regular password)
FROM_EMAIL=your-email@gmail.com      # Email address shown in "From" field
```

### Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Glasgow Bengali FC"
   - Copy the 16-character password
3. **Set Environment Variables**:
   ```bash
   export SMTP_SERVER=smtp.gmail.com
   export SMTP_PORT=587
   export SMTP_USERNAME=your-email@gmail.com
   export SMTP_PASSWORD=your-16-char-app-password
   export FROM_EMAIL=your-email@gmail.com
   ```

### Alternative Email Providers

#### Outlook/Hotmail
```bash
export SMTP_SERVER=smtp-mail.outlook.com
export SMTP_PORT=587
export SMTP_USERNAME=your-email@outlook.com
export SMTP_PASSWORD=your-password
```

#### Yahoo Mail
```bash
export SMTP_SERVER=smtp.mail.yahoo.com
export SMTP_PORT=587
export SMTP_USERNAME=your-email@yahoo.com
export SMTP_PASSWORD=your-app-password
```

#### SendGrid (Production Recommended)
```bash
export SMTP_SERVER=smtp.sendgrid.net
export SMTP_PORT=587
export SMTP_USERNAME=apikey
export SMTP_PASSWORD=your-sendgrid-api-key
```

## Local Development

For local testing without email:
- Leave `SMTP_USERNAME` and `SMTP_PASSWORD` empty
- The system will return a helpful error message instead of sending email
- Users will be instructed to contact the administrator

## Production Deployment (Render)

1. Go to your Render dashboard
2. Select your web service
3. Go to "Environment" tab
4. Add the environment variables:
   - `SMTP_SERVER`
   - `SMTP_PORT`
   - `SMTP_USERNAME`
   - `SMTP_PASSWORD`
   - `FROM_EMAIL`
5. Save changes and redeploy

## Testing

### Test Forgot Password Feature

1. Start the backend server
2. Go to the login page
3. Enter a registered email address
4. Click "Forgot Password?" button
5. Check the email inbox for the password recovery message

### Expected Email Content

```
Subject: Glasgow Bengali FC - Password Recovery

Hello [User Name],

You requested password recovery for your Glasgow Bengali FC account.

Unfortunately, for security reasons, we cannot retrieve your original password as it is encrypted in our system.

Please contact the administrator at super@admin.com to reset your password, or try remembering your password.

If you did not request this, please ignore this email.

Best regards,
Glasgow Bengali FC Team
```

## Troubleshooting

### Email Not Sending

1. **Check environment variables are set correctly**
   ```python
   import os
   print(os.environ.get('SMTP_USERNAME'))
   print(os.environ.get('SMTP_PASSWORD'))
   ```

2. **Gmail "Less secure app access" error**
   - Use App Password instead of regular password
   - Enable 2-Factor Authentication first

3. **Connection timeout**
   - Check firewall settings
   - Verify SMTP_SERVER and SMTP_PORT are correct
   - Try port 465 (SSL) instead of 587 (TLS)

4. **Authentication failed**
   - Verify username and password are correct
   - For Gmail, ensure you're using App Password
   - Check if account has 2FA enabled

### Backend Logs

Check the backend console for error messages:
```
Email not configured. Set SMTP_USERNAME and SMTP_PASSWORD environment variables.
Failed to send email: [error details]
```

## Security Best Practices

✅ **DO:**
- Use App Passwords for Gmail
- Use environment variables for credentials
- Never commit credentials to version control
- Use SendGrid or similar service for production
- Implement rate limiting on forgot password endpoint

❌ **DON'T:**
- Store passwords in plain text
- Send actual passwords via email
- Hardcode email credentials in code
- Use personal email for production

## Future Improvements

Consider implementing:
1. **Password Reset Tokens**: Generate temporary reset links instead of sending passwords
2. **Rate Limiting**: Prevent abuse of forgot password feature
3. **Email Templates**: Use HTML email templates for better formatting
4. **Email Verification**: Verify email addresses during signup
5. **Two-Factor Authentication**: Add extra security layer
