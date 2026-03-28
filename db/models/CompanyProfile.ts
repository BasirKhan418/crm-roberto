import mongoose from "mongoose";
const CompanyProfileSchema = new mongoose.Schema({
    user:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: { type: String, required: true,trim: true, },
    
      ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },

    businessEmail: {
      type: String,
      required: [true, 'Business email is required'],
      lowercase: true,
      trim: true,
    },
 
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    vatNumber: {
      type: String,
      required: [true, 'VAT number is required'],
      trim: true,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    logoKey: {
      type: String,
      default: null,
    },
}, { timestamps: true })
export default mongoose.models.CompanyProfile || mongoose.model('CompanyProfile', CompanyProfileSchema);