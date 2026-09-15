import express from 'express';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const router = express.Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Needs service role to bypass RLS and update status

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  global: { WebSocket },
  realtime: { transport: WebSocket }
});

router.post('/request-approval', async (req, res) => {
  const { email, userId } = req.body;
  if (!email || !userId) {
    return res.status(400).json({ error: 'Email and userId are required' });
  }

  // If SMTP is not configured, we still return success to not block the frontend, but log the warning.
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.warn('WARNING: SMTP_EMAIL or SMTP_PASSWORD not set. Cannot send approval email.');
    return res.json({ success: true, message: 'SMTP not configured, email skipped' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      }
    });

    const approvalUrl = `https://website-migration-tool.up.railway.app/api/admin/approve/${userId}`;

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: 'datyal.upwork@gmail.com',
      subject: 'New User Registration - Approval Required',
      html: `
        <h2>New User Registration</h2>
        <p>A new user has registered and is waiting for approval to access the Website Migration Tool.</p>
        <p><strong>Email:</strong> ${email}</p>
        <br/>
        <a href="${approvalUrl}" style="padding: 10px 20px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px;">Approve User</a>
        <br/><br/>
        <p>If you don't recognize this user, you can ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Approval request sent' });
  } catch (error) {
    console.error('Error sending approval email:', error);
    res.status(500).json({ error: 'Failed to send approval email' });
  }
});

router.get('/approve/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ status: 'approved' })
      .eq('id', userId);

    if (error) throw error;

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background-color: #0A0C10; color: white;">
          <h2 style="color: #10B981;">User Approved Successfully!</h2>
          <p>The user can now log in and access the application.</p>
          <a href="https://website-migration-tool.up.railway.app" style="color: #10B981; text-decoration: underline;">Go to Application</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).send('Error approving user. They may not exist or the database connection failed.');
  }
});

export default router;
