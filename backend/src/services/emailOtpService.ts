import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function hashOtp(otp: string) {
  return bcrypt.hash(otp, 10);
}

export async function verifyOtp(otp: string, hash: string) {
  return bcrypt.compare(otp, hash);
}

export async function sendEmailOtp(email: string, otp: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`EMAIL OTP for ${email}: ${otp}`);
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Your AutoGST OTP",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`
  });
}
