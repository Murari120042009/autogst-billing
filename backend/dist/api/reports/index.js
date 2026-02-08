"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const gstr1Summary_1 = __importDefault(require("./gstr1Summary"));
const gstr1Invoices_1 = __importDefault(require("./gstr1Invoices"));
const router = express_1.default.Router();
router.use("/gstr1/summary", gstr1Summary_1.default);
router.use("/gstr1/invoices", gstr1Invoices_1.default);
exports.default = router;
