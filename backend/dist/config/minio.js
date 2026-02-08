"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.minioClient = void 0;
exports.uploadBufferToMinio = uploadBufferToMinio;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const minio_1 = require("minio");
if (!process.env.MINIO_ENDPOINT) {
    throw new Error("MINIO_ENDPOINT is not defined");
}
exports.minioClient = new minio_1.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});
async function uploadBufferToMinio({ bucketName, objectName, buffer }) {
    await exports.minioClient.putObject(bucketName, objectName, buffer);
    return `${process.env.MINIO_PUBLIC_URL}/${bucketName}/${objectName}`;
}
