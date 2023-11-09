import mongoose, { Schema } from "mongoose";

const cronScheduleSchema: Schema = new Schema({
  dateAndTimeFrom: { type: String, required: false },
  dateAndTimeTo: { type: String, required: false },
  uniqueCronName: { type: String, required: false },
  userEmail: [{ type: String, required: false }],
  cronRunningStatus: { type: String, enum: ['start', 'stop'], default: 'start' },
  cronStatus: { type: Boolean, default: true },
  createdBy: { type: String, required: false }
},
  { timestamps: true }
)
const Cron = mongoose.model("Cron", cronScheduleSchema);
export default Cron;