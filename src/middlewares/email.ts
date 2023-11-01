import nodemailer from "nodemailer";
import { environmentConfig } from "../config/environmentConfig";


//  nodemailer transporter
 export const transporter = nodemailer.createTransport({
  host: environmentConfig.EMAIL_HOST as string,
  port: parseInt(environmentConfig.EMAIL_PORT as unknown as string),
  secure: false,
  auth: {
    user: environmentConfig.EMAIL_USER as string,
    pass: environmentConfig.EMAIL_PASSWORD as string,
  },
});
