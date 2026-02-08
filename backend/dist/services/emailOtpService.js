"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOtp = generateOtp;
exports.hashOtp = hashOtp;
exports.verifyOtp = verifyOtp;
exports.sendEmailOtp = sendEmailOtp;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bcrypt_1 = __importDefault(require("bcrypt"));
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function hashOtp(otp) {
    return bcrypt_1.default.hash(otp, 10);
}
async function verifyOtp(otp, hash) {
    return bcrypt_1.default.compare(otp, hash);
}
async function sendEmailOtp(email, otp) {
    if (!process.env.RESEND_API_KEY) {
        console.log(`EMAIL OTP for ${email}: ${otp}`);
        return;
    }
    await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: "Your AutoGST OTP",
        text: `Your OTP is ${otp}. It expires in 5 minutes.`
    });
}
