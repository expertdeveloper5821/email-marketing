import mongoose, { Schema } from "mongoose";

const emailMarketingSchema: Schema = new Schema({

  email: [{ type: String, required: false }],
  cronSchedule: { type: String, required: false },
  csvFile: { type: String, required: false },
},
{ timestamps: true }
)
const Email = mongoose.model("email", emailMarketingSchema);
export default Email;