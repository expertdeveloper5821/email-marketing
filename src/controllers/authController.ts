import User from '../models/authModel';
import express, { Request, Response } from 'express';
import csv from 'csv-parser';
import fs from 'fs';
import { CustomRequest } from '../middlewares/verifyToken'



const router = express.Router(); // Initialize Express router
router.use(express.static('views')); // Serve static files from the public directory


// Handle CSV file upload
export const uploadCSV = async (req: CustomRequest, res: Response) => {
    try {
      // Check if a file has been uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
  
      // Read and process the CSV file 
      const results: any[] = [];
  
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', async (data: any) => {
          try {
            const user = new User({
              userName: data['Person Name'],
              email: data['E_mail'],
              address: data['Location'],
              phoneNumber: data['Contact no.'],
              companyName: data["Comapny's Name"],
              designation: data['Designation'],
              createdBy: req.user?.user_id,
            });
  
            results.push(user);
          } catch (error) {
            console.error('Error extracting data from CSV:', error);
          }
        })
        .on('end', async () => {
          try {
            for (const user of results) {
              const existingUser = await User.findOne({ email: user.email });
  
              if (!existingUser) {
                try {
                  const newUser = new User(user);
                  await newUser.save();
                } catch (error) {
                  console.error('Error saving user:', error);
                  return res.status(500).json({ message: 'Error saving user' });
                }
              }
            }
  
            return res.status(200).json({ message: 'CSV file uploaded and processed successfully' });
          } catch (error) {
            console.error('Error processing CSV:', error);
            return res.status(500).json({ message: 'Error processing CSV' });
          }
        });
    } catch (error) {
      console.error('Internal server error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };

  export default router;