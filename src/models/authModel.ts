import mongoose, { Schema } from "mongoose";

const userSchema: Schema = new Schema({
    userName: { type: String, required: false },
    email: { type: String, required: false },
    address: { type: String, required: false },
    phoneNumber: { type: String, required: false },
    companyName: { type: String, required: false },
    designation: { type: String, required: false },
    csvFile: { type: String, required: false },
    createdBy: { type: mongoose.Types.ObjectId , ref: 'Auth' }
},
    { timestamps: true }
)
const User = mongoose.model("User", userSchema);
export default User;