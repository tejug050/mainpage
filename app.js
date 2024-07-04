const express = require('express');
const formidable = require('formidable');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
const port = 3000;


// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'teju123',
  database: 'company_intranet'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// Enable CORS
app.use(cors());
app.use(express.static('upload'));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'teju05omni@gmail.com', // Replace with your Gmail account
    pass: 'civo bvhw hupd nsia', // Replace with your Gmail password or generate an app password
  },
});
// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Route to handle posting a message
app.post('/post-message', async (req, res) => {
  const { messageContent, senderEmail, receiverEmail } = req.body;
  if (!messageContent || !senderEmail || !receiverEmail) {
    return res.status(400).json({ error: 'Message content, sender email, and receiver email are required' });
  }

  // Remove HTML tags from the message content
  const plainMessage = messageContent.replace(/<\/?[^>]+(>|$)/g, '');

  // Adjust timestamp for sent_at
  const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Send email with customized sender address
  const mailOptions = {
    from: senderEmail,
    to: receiverEmail,
    subject: 'New Message Received',
    text: plainMessage
  };

  // Send email and handle response
  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ error: 'Error sending email' });
    }
    console.log('Email sent:', info.response);

    try {
      // Save the sent message to the database with the adjusted timestamp and plain message content
      const sql = 'INSERT INTO messages (content, sender_email, receiver_email, created_at, sent_at) VALUES (?, ?, ?, ?, ?)';
      const result = await db.query(sql, [plainMessage, senderEmail, receiverEmail, currentDate, currentDate]);

      // Include the inserted message ID in the response
      res.status(200).json({ message: 'Message sent successfully', messageId: result.insertId });
    } catch (err) {
      console.error('Error saving message to database:', err);
      return res.status(500).json({ error: 'Error saving message to database' });
    }
  });
});

app.get('/sent-messages', async (req, res) => {
  try {
    const sql = 'SELECT content, sender_email, receiver_email, created_at AS sent_at FROM messages WHERE sender_email = ? ORDER BY created_at DESC';
    const senderEmail = req.query.senderEmail;
    const results = await db.query(sql, [senderEmail]);

    // Check if results is not empty
    if (results.length > 0) {
      res.status(200).json(results);
    } else {
      console.error('No sent messages found');
      res.status(404).json({ error: 'No sent messages found' });
    }
  } catch (err) {
    console.error('Error retrieving sent messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/index.html')); // Adjust the path as needed
});

// Define routes
app.post('/signup', (req, res) => {
  const { username, password, confirmPassword, email, phone, gender, zip } = req.body;

  // Validate form data
  if (!username || !password || !confirmPassword || !email || !phone || !gender || !zip) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  // Save data to MySQL
  const sql = 'INSERT INTO users (username, password, email, phone, gender, zip) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(sql, [username, password, email, phone, gender, zip], (err, result) => {
    if (err) {
      console.error('Error saving user data:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    console.log('User registered:', result);
    res.status(200).json({ message: 'User registered successfully' });
  });
});


app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Check if username and password are correct
  const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(sql, [username, password], (err, results) => {
    if (err) {
      console.error('Error checking login credentials:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }

    // Check if any user matched the provided username and password
    if (results.length > 0) {
      // Send a JSON response indicating successful login
      return res.status(200).json({ message: 'Login successful' });
    } else {
      // Send a JSON response indicating invalid credentials
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  });
});
app.get('/user-info-endpoint', (req, res) => {
  // Query the database to fetch user information
  const sql = 'SELECT * FROM users WHERE id = ?'; // Original query
  db.query(sql, [req.query.userId], (err, result) => {
    if (err) {
      console.error('Error fetching user info from database:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    if (result.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json(result[0]);
  });
});

// Route to handle posting a message
app.post('/post-message', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const sql = 'INSERT INTO messages (content) VALUES (?)';
  db.query(sql, [message], (err, result) => {
    if (err) {
      console.error('Error posting message:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    console.log('Message posted successfully');
    res.sendStatus(200);
  });
});

// Route to handle retrieving messages
app.get('/get-messages', (req, res) => {
  const sql = 'SELECT * FROM messages';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error retrieving messages:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(results);
  });
});

// Define a function to convert date from 'DD-MMM-YYYY' to 'YYYY-MM-DD' format
function convertDateFormat(dateString) {
  const parts = dateString.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = monthNames.indexOf(parts[1]);
  const year = parts[2];
  const month = (monthIndex + 1).toString().padStart(2, '0'); // Pad month with leading zero if needed
  const day = parts[0].padStart(2, '0'); // Pad day with leading zero if needed
  return `${year}-${month}-${day}`;
}

// Use the converted date format before inserting into the database
app.post('/submit', (req, res) => {
const { holiday_name, date } = req.body;

// Convert date format
const convertedDate = convertDateFormat(date);

// Insert the holiday data into the database
const sql = 'INSERT INTO holidays (holiday_name, date) VALUES (?, ?)';
db.query(sql, [holiday_name, convertedDate], (err, result) => {
  if (err) {
    console.error('Error inserting data into MySQL:', err);
    res.status(500).send('Internal Server Error');
    return;
  }
  console.log('New holiday data inserted into the database');
  res.status(200).send('Holiday data inserted successfully');
});
});

app.get('/holidays', (req, res) => {
  const query = 'SELECT holiday_name, date FROM holidays';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching holiday data:', err);
      res.status(500).json({ error: 'Error fetching holiday data' });
      return;
    }
    res.json(results);
  });
});

app.get('/holidays', async (req, res) => {
  try {
      // Retrieve all holidays from the database
      const holidays = await Holiday.find({}, { _id: 0, __v: 0 }).lean();

      res.json(holidays);
  } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
  }
});

// Handle delete request
app.post('/delete', (req, res) => {
  const holidayName = req.body.holiday_name;
const deleteQuery = `DELETE FROM holidays WHERE holiday_name = '${holidayName}'`;


  db.query(deleteQuery, (err, result) => {
      if (err) {
          console.error('Error deleting row from database:', err);
          res.status(500).send('Error deleting row from database');
          return;
      }
      console.log('Row deleted from database');
      res.status(200).send('Row deleted from database');
  });
});
// Route to post announcements
app.post('/api/announcements', (req, res) => {
  const { title, content, sender } = req.body;

  // Validate announcement data
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required for an announcement' });
  }

  // Save the announcement to the database
  const sql = 'INSERT INTO announcements (title, content, sender) VALUES (?, ?, ?)';
  db.query(sql, [title, content, sender], (err, result) => {
    if (err) {
      console.error('Error saving announcement:', err);
      return res.status(500).json({ error: 'Failed to save announcement' });
    }
    console.log('Announcement posted successfully');
    res.status(200).json({ message: 'Announcement posted successfully' });
  });
});

// Route to handle fetching announcements
app.get('/api/announcements', (req, res) => {
  const sql = 'SELECT title, content, sender, created_at FROM announcements';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error retrieving announcements:', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    res.status(200).json(results);
  });
});

// Close modal route
app.post('/close-modal', (req, res) => {
  // Logic to close the modal
});
const storage = multer.diskStorage({
  destination: '/var/www/html/upload', // Change this to your desired directory
  destination: '/var/www/html/public',
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });


// Route to handle posting a message
app.post('/post-message', (req, res) => {
  const { message, senderId, receiverId } = req.body;
  if (!message || !senderId || !receiverId) {
    return res.status(400).json({ error: 'Message content, senderId, and receiverId are required' });
  }

  const sql = 'INSERT INTO messages (content, sender_id, receiver_id) VALUES (?, ?, ?)';
  db.query(sql, [message, senderId, receiverId], (err, result) => {
    if (err) {
      console.error('Error posting message:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    console.log('Message posted successfully');
    res.sendStatus(200);
  });
});

// Route to handle retrieving messages for a user
app.get('/get-messages/:userId', (req, res) => {
  const userId = req.params.userId;
  const sql = 'SELECT * FROM messages WHERE receiver_id = ?';
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Error retrieving messages:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(results);
  });
});

// Route to handle deleting a message
app.post('/delete-message', (req, res) => {
  const messageId = req.body.messageId;
  if (!messageId) {
    return res.status(400).json({ error: 'Message ID is required' });
  }

  const sql = 'DELETE FROM messages WHERE id = ?';
  db.query(sql, [messageId], (err, result) => {
    if (err) {
      console.error('Error deleting message:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    console.log('Message deleted successfully');
    res.sendStatus(200);
  });
});

// Route to handle file upload
app.post('/public', upload.array('images', 20), (req, res) => {
  // You can perform database operations here if needed
  res.status(200).json({ message: 'Files uploaded successfully' });
});


app.get('/images', (req, res) => {
  const imageFolder = '/var/www/html/public'; // Change this to your image folder path
  fs.readdir(imageFolder, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    const imagePaths = files.map(file => '/public/' + file); // Adjust the path as needed
    res.status(200).json({ images: imagePaths });
  });
});

app.post('/remove-image', (req, res) => {
  const imagePath = req.body.imagePath;
  const imageFilePath = path.join('/var/www/html', imagePath);

  // Check if the file exists
  if (fs.existsSync(imageFilePath)) {
    // Remove the file
    fs.unlink(imageFilePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      // File successfully deleted
      res.status(200).json({ message: 'File deleted successfully' });
    });
  } else {
    // File does not exist
    res.status(404).json({ error: 'File not found' });
  }
});

// Route to handle replying to a message
app.post('/reply-message', async (req, res) => {
  const { messageContent, senderEmail, receiverEmail } = req.body;
  if (!messageContent || !senderEmail || !receiverEmail) {
    return res.status(400).json({ error: 'Message content, sender email, and receiver email are required' });
  }

  // Remove HTML tags from the message content
  const plainMessage = messageContent.replace(/<\/?[^>]+(>|$)/g, '');

  // Send email with customized sender address
  const mailOptions = {
    from: senderEmail,
    to: receiverEmail,
    subject: 'Replying to Your Message',
    text: plainMessage
  };

  // Send email and handle response
  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ error: 'Error sending email' });
    }
    console.log('Email sent:', info.response);

    try {
      // Adjust timestamp
      const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Save the replied message to the inbox
      const sql = 'INSERT INTO inbox_messages (content, sender_email, receiver_email, created_at) VALUES (?, ?, ?, ?)';
      await db.query(sql, [plainMessage, senderEmail, receiverEmail, currentDate]);

      console.log('Replied message saved to inbox');
      res.sendStatus(200);
    } catch (err) {
      console.error('Error saving replied message to inbox:', err);
      return res.status(500).json({ error: 'Error saving replied message to inbox' });
    }
  });
});

// Route to retrieve inbox messages
app.get('/inbox-messages', (req, res) => {
  const sql = 'SELECT * FROM inbox_messages ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error retrieving inbox messages:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.status(200).json(results);
  });
});

// Endpoint to handle IT support requests
app.post('/submit-request', (req, res) => {
  const { name, email, requestType, description } = req.body;

  // Insert the request into the database
  const sql = 'INSERT INTO it_requests (name, email, request_type, description) VALUES (?, ?, ?, ?)';
  db.query(sql, [name, email, requestType, description], (error, results) => {
    if (error) {
      console.error('Error inserting request into database:', error);
      return res.status(500).send('Internal Server Error');
    }
    console.log('Request submitted successfully.');
    res.status(200).send('Request submitted successfully.');

    // Send email notification
    const mailOptions = {
      from: 'teju05omni@gmail.com',
      to: email, // Send the email notification to the email provided in the form
      subject: 'New IT Support Request',
      text: `A new IT support request has been received:\n\nRequest Type: ${requestType}\nDescription: ${description}\n\nThank you.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });
  });
});

// Route to handle feedback form submissions
app.post('/submit_feedback', (req, res) => {
    const { date, category, feedback, category_other } = req.body;

    let sql;
    let values;

    if (category === 'Other' && category_other) {
        // If category is 'Other' and category_other has a value, use it
        sql = 'INSERT INTO feedback (date, category_other, feedback) VALUES (?, ?, ?)';
        values = [date, category_other, feedback];
    } else {
        // Otherwise, insert as usual with the provided category
        sql = 'INSERT INTO feedback (date, category, feedback) VALUES (?, ?, ?)';
        values = [date, category, feedback];
    }

    // Insert feedback data into the database
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error submitting feedback:', err);
            res.status(500).send('Error submitting feedback');
        } else {
            console.log('Feedback submitted successfully');
            res.status(200).send('Feedback submitted successfully');
        }
    });
});

// Route to fetch feedback data
app.get('/feedback_data', (req, res) => {
    // Fetch feedback data from the database
    db.query('SELECT * FROM feedback', (err, result) => {
        if (err) {
            console.error('Error fetching feedback data:', err);
            res.status(500).json({ error: 'Error fetching feedback data' }); // Send JSON error response
        } else {
            // Send feedback data as JSON
            res.status(200).json(result);
        }
    });
});

app.get('/feedback_page', (req, res) => {
    res.sendFile(path.join(__dirname, 'feedback.html'));
});
// Sample initial discussion posts data
let initialDiscussionPosts = [];

// Route to fetch discussion posts
app.get('/discussionPosts', (req, res) => {
const sql = 'SELECT * FROM discussion_posts ORDER BY datetime DESC';
db.query(sql, (err, results) => {
if (err) {
res.status(500).json({ message: err.message });
return;
}
res.json(results);
});
});

// Route to add a new discussion post
app.post('/discussionPosts', (req, res) => {
const { name, content } = req.body;
const sql = 'INSERT INTO discussion_posts (name, content) VALUES (?, ?)';
db.query(sql, [name, content], (err, result) => {
if (err) {
res.status(400).json({ message: err.message });
return;
}
res.status(201).json({ message: 'Post added successfully.' });
});
});

// Route to delete a discussion post by ID
app.delete('/discussionPosts/:postId', (req, res) => {
const postId = req.params.postId; // Get postId from request parameters
const sql = 'DELETE FROM discussion_posts WHERE id = ?';
db.query(sql, postId, (err, result) => {
if (err) {
console.error('Error deleting discussion post:', err);
res.status(500).json({ message: 'Internal Server Error' });
return;
}
console.log('Discussion post deleted successfully');
res.json({ message: 'Post deleted successfully.' });
});
});


app.post('/submitLeave', (req, res) => {
  const { employeeName, startDate, endDate, reason } = req.body;

  // Insert form data into MySQL database
  const sql = 'INSERT INTO leave_requests (employeeName, startDate, endDate, reason) VALUES (?, ?, ?, ?)';
  db.query(sql, [employeeName, startDate, endDate, reason], (err, result) => {
    if (err) {
      console.error('Error inserting data into MySQL:', err);
      res.status(500).send('Error submitting leave');
      return;
    }
    console.log('Leave submitted successfully');
    res.status(200).send('Leave submitted successfully');
  });
});

app.get('/leaveRequests/:employeeName', (req, res) => {
  const employeeName = req.params.employeeName;

  const sql = 'SELECT DATE_FORMAT(startDate, "%Y-%m-%d") AS startDate, DATE_FORMAT(endDate, "%Y-%m-%d") AS endDate FROM leave_requests WHERE employeeName = ?';
  db.query(sql, [employeeName], (err, results) => {
    if (err) {
      console.error('Error fetching leave requests:', err);
      res.status(500).send('Error fetching leave requests');
      return;
    }
    res.json(results);
  });
});

app.get('/fetchLeaveRequests/:employeeName', (req, res) => {
  const employeeName = req.params.employeeName;

  const sql = 'SELECT reason, startDate, endDate FROM leave_requests WHERE employeeName = ?';
  db.query(sql, [employeeName], (err, results) => {
    if (err) {
      console.error('Error fetching leave requests:', err);
      res.status(500).send('Error fetching leave requests');
      return;
    }
    res.json(results);
  });
});

app.use('/upload', express.static(path.join(__dirname, 'upload')));

app.get('/files', (req, res) => {
    // Extract category from query parameters
    const category = req.query.category;
    // Construct the directory path based on the category
    const categoryDirectory = path.join(__dirname, 'upload', category);

    // Read the files in the category directory
    fs.readdir(categoryDirectory, (err, files) => {
        if (err) {
            // Handle error if reading files fails
            console.error(`Error reading files for category '${category}':`, err);
            return res.status(500).send('Error reading files');
        } else {
            // Map files to an array of objects containing file name and URL
            const fileLinks = files.map(file => ({
                name: file,
                url: `/upload/${category}/${file}`
            }));
            // Send the file links as JSON response
            res.json(fileLinks);
        }
    });
});

app.post('/upload', upload.array('files'), (req, res) => {
  const category = req.body.category;

  // Check if the category directory exists, if not, create it
  const categoryDirectory = path.join('/var/www/html/upload', category);
  if (!fs.existsSync(categoryDirectory)) {
      fs.mkdirSync(categoryDirectory);
  }

  // Move files to the category directory
  req.files.forEach(file => {
      const filePath = path.join(categoryDirectory, file.originalname);
      fs.renameSync(file.path, filePath); // Move file to category directory
  });

  res.status(200).send('Files uploaded successfully');
});

app.get('/documents', (req, res) => {
  const category = req.query.category;
  const uploadDirectory = '/var/www/html/upload';

  fs.readdir(uploadDirectory, (err, files) => {
      if (err) {
          console.error('Error reading directory:', err);
          return res.status(500).send('Error reading directory');
      }

      // Filter files that belong to the specified category
      const categoryFiles = files.filter(file => file.startsWith(category));
      res.json(categoryFiles);
  });
});

// GET Route to fetch all tasks
app.get('/tasks', (req, res) => {
  const username = req.query.username; // Get the username from query parameters
  const sql = 'SELECT * FROM tasks WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      res.status(500).json({ error: 'Error fetching tasks' });
      return;
    }
    res.json(results);
  });
});

// Example route for saving a task
app.post('/tasks', (req, res) => {
    const { taskName, startDate, dueDate, comment, username } = req.body;

    // Calculate total days
    const start = new Date(startDate);
    const end = new Date(dueDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // Calculate difference in days

    // Save to database including total_days
    const sql = 'INSERT INTO tasks (task_name, start_date, due_date, comment, username, total_days) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [taskName, startDate, dueDate, comment, username, totalDays], (err, result) => {
        if (err) {
            console.error('Error saving task:', err);
            return res.status(500).json({ error: 'Error saving task' });
        }
        res.status(201).json({ message: 'Task saved successfully' });
    });
});

app.put('/tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    const { taskName, startDate, dueDate, comment, status } = req.body;

    // Update the task in your database
    const sql = "UPDATE tasks SET task_name=?, start_date=?, due_date=?, comment=?, status=? WHERE task_id=?";
    db.query(sql, [taskName, startDate, dueDate, comment, status, taskId], (err, result) => {
        if (err) {
            console.error("Error updating task:", err);
            res.status(500).json({ error: 'Error updating task' });
            return;
        }

        console.log("Task updated successfully");
        res.status(200).json({ message: 'Task updated successfully' });
    });
});
// Example route for fetching a task by ID
app.get('/tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    const sql = 'SELECT * FROM tasks WHERE task_id = ?';
    db.query(sql, [taskId], (err, results) => {
        if (err) {
            console.error('Error fetching task by ID:', err);
            res.status(500).json({ error: 'Error fetching task' });
            return;
        }
        if (results.length === 0) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.json(results[0]); // Return the first (and only) result
    });
});

// DELETE Route to delete a task
app.delete('/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;

    const query = 'DELETE FROM tasks WHERE task_id = ?';
db.query(query, [taskId], (err, result) => {
        if (err) {
            console.error('Error deleting task:', err);
            res.status(500).json({ error: 'Error deleting task' });
            return;
        }
        console.log('Task deleted successfully');
        res.json({ success: true });
    });
});

function fetchAndSendTasks(res) {
const query = 'SELECT task_id, task_name, DATE_FORMAT(start_date, "%Y-%m-%d") AS start_date, DATE_FORMAT(due_date, "%Y-%m-%d") AS due_date, status, comment FROM tasks';
db.query(query, (err, results) => {
  if (err) {
      console.error('Error fetching tasks:', err);
      res.status(500).json({ error: 'Error fetching tasks' });
      return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.json(results);
});
}
app.get('/tasks/all', (req, res) => {
    const sql = 'SELECT * FROM tasks';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching all tasks:', err);
            res.status(500).json({ error: 'Error fetching all tasks' });
            return;
        }
        res.json(results); // Send JSON response with tasks data
    });
});


app.use(express.json());

app.post('/bookings', (req, res) => {
    const { username, room, date, time } = req.body;

    if (!username || !room || !date || !time) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if the time slot is already booked
    const query = 'SELECT * FROM bookings WHERE room = ? AND date = ? AND time = ?';
    db.query(query, [room, date, time], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (results.length > 0) {
            // Time slot already booked
            return res.json({ success: false, bookedBy: results[0].username });
        } else {
            // Save the booking
            const insertQuery = 'INSERT INTO bookings (username, room, date, time) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [username, room, date, time], (err, results) => {
                if (err) {
                    console.error('Database insertion error:', err);
                    return res.status(500).json({ success: false, message: 'Internal server error' });
                }
                res.json({ success: true });
            });
        }
    });
});

// Fetch Booked Slots for a Day
app.get('/bookings/:date', (req, res) => {
    const date = req.params.date;
    const sql = 'SELECT * FROM bookings WHERE date = ?';
    db.query(sql, [date], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.status(200).json(results);
        }
    });
});

// Route to fetch booked slots for today's date
app.get('/bookings/today', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const sql = 'SELECT * FROM bookings WHERE date = ?';
    db.query(sql, [today], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.status(200).json(results);
        }
    });
});

// Handle POST request to save attendance record
app.post('/attendance', async (req, res) => {
    const { username, date, day, loginTime, logoutTime, workedHours, reason } = req.body;

    // Convert loginTime from ISO string to MySQL DATETIME format
    const formattedLoginTime = new Date(loginTime).toISOString().slice(0, 19).replace('T', ' ');

    // Parse the logout time into a Date object
    let parsedLogoutTime = new Date(logoutTime);

    // Check if the logout time is before 6:00 PM
    if (parsedLogoutTime.getHours() < 18 || (parsedLogoutTime.getHours() === 18 && parsedLogoutTime.getMinutes() < 0)) {
        // If so, adjust the logout time to 6:00 PM
        parsedLogoutTime.setHours(18, 0, 0);
    }

    // Convert logoutTime from Date object to MySQL DATETIME format
    const formattedLogoutTime = parsedLogoutTime.toISOString().slice(0, 19).replace('T', ' ');

    try {
        db.query(
            'INSERT INTO attendance_records (username, date, day, login_time, logout_time, worked_hours, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, date, day, formattedLoginTime, formattedLogoutTime, workedHours, reason],
            (error, results) => {
                if (error) {
                    console.error('Error executing query:', error);
                    return res.status(500).send('Error saving attendance record.');
                }

                res.status(200).send('Attendance recorded successfully.');

                // Send email if reason is provided
                if (reason) {
                    const mailOptions = {
                        from: `${username} <teju05omni@gmail.com>`,
                        to: 'teju@omni-techsolutions.com',
                        subject: 'Early Logout Notification',
                        text: `User ${username} has logged out early. Reason: ${reason}`,
                    };
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.log('Error sending email:', error);
                        } else {
                            console.log('Email sent:', info.response);
                        }
                    });
                }
            }
        );
    } catch (error) {
        console.error('Error saving attendance:', error);
        res.status(500).send('Error saving attendance record.');
    }
});

// Fetch attendance records
app.get('/attendance', (req, res) => {
    const selectedDate = req.query.date;
    const username = req.query.username; // Retrieve username from query parameters

    let query = 'SELECT * FROM attendance_records WHERE username = ?';
    let queryParams = [username];

    if (selectedDate) {
        query += ' AND DATE(date) = ?'; // Ensure proper date comparison
        queryParams.push(selectedDate);
    }

    db.query(query, queryParams, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            return res.status(500).send('Error fetching attendance records.');
        }
        res.status(200).json(results);
    });
});
// Fetch usernames
app.get('/usernames', (req, res) => {
    db.query('SELECT DISTINCT username FROM attendance_records', (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            return res.status(500).send('Error fetching usernames.');
        }

        const usernames = results.map(row => row.username);
        res.json(usernames);
    });
});

// Fetch user attendance records
app.get('/user-attendance', (req, res) => {
    const { username, date } = req.query;
    let query = 'SELECT * FROM attendance_records WHERE username = ?';
    let queryParams = [username];

    if (date) {
        query += ' AND DATE(date) = ?';
        queryParams.push(date);
    }

    db.query(query, queryParams, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            return res.status(500).send('Error fetching attendance records.');
        }
        res.json(results);
    });
});
// Middleware for checking authentication
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next(); // Proceed to the next middleware or route handler
  }
  res.status(401).json({ error: 'Unauthorized' });
};

// Create a new post
app.post('/api/posts', isAuthenticated, (req, res) => {
  const { author, body } = req.body;
  const sql = 'INSERT INTO posts (author, body) VALUES (?, ?)';
  db.query(sql, [author, body], (err, result) => {
    if (err) {
      console.error('Error adding new post:', err);
      return res.status(500).json({ error: 'Error adding new post' });
    }
    res.status(201).json({ id: result.insertId, author: author, body: body });
  });
});

// Get all posts
app.get('/api/posts', (req, res) => {
  const sql = 'SELECT * FROM posts ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching posts:', err);
      return res.status(500).json({ error: 'Error fetching posts' });
    }
    res.json(results);
  });
});

// Update post by ID - Restrict to Author Only
app.put('/api/posts/:postId', isAuthenticated, (req, res) => {
  const { body } = req.body;
  const { postId } = req.params;
  const author = req.user.username;

  const sql = 'UPDATE posts SET body = ? WHERE id = ? AND author = ?';
  db.query(sql, [body, postId, author], (err, result) => {
    if (err) {
      console.error('Error updating post:', err);
      return res.status(500).json({ error: 'Error updating post' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }
    res.json({ id: postId, body: body });
  });
});

// Delete post by ID - Restrict to Author Only
app.delete('/api/posts/:postId', isAuthenticated, (req, res) => {
  const { postId } = req.params;
  const author = req.user.username;

  const sql = 'DELETE FROM posts WHERE id = ? AND author = ?';
  db.query(sql, [postId, author], (err, result) => {
    if (err) {
      console.error('Error deleting post:', err);
      return res.status(500).json({ error: 'Error deleting post' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }
    res.json({ message: 'Post deleted successfully' });
  });
});

// Get comments by post ID
app.get('/api/comments/:postId', (req, res) => {
  let sql = 'SELECT * FROM comments WHERE post_id = ? ORDER BY timestamp';
  db.query(sql, [req.params.postId], (err, results) => {
    if (err) {
      console.error('Error fetching comments:', err);
      res.status(500).json({ error: 'Error fetching comments' });
    } else {
      res.json(results);
    }
  });
});

// Routes
app.post('/api/comments', (req, res) => {
    const { post_id, author, body } = req.body;
    let sql = 'INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)';
    db.query(sql, [post_id, author, body], (err, result) => {
        if (err) {
            console.error('Error adding new comment:', err);
            res.status(500).json({ error: 'Error adding new comment' });
        } else {
            res.status(201).json({ id: result.insertId, post_id: post_id, author: author, body: body });
        }
    });
});

// Update comment by ID - Restrict to Author Only
app.put('/api/comments/:commentId', isAuthenticated, (req, res) => {
  const { body } = req.body;
  const { commentId } = req.params;
  const author = req.user.username; // Assuming username is stored in req.user.username after authentication

  let sql = 'UPDATE comments SET body = ? WHERE id = ? AND author = ?';
  db.query(sql, [body, commentId, author], (err, result) => {
    if (err) {
      console.error('Error updating comment:', err);
      res.status(500).json({ error: 'Error updating comment' });
    } else if (result.affectedRows === 0) {
      res.status(403).json({ error: 'Unauthorized' });
    } else {
      res.json({ id: commentId, body: body });
    }
  });
});

// Delete comment by ID - Restrict to Author Only
app.delete('/api/comments/:commentId', isAuthenticated, (req, res) => {
  const { commentId } = req.params;
  const author = req.user.username; // Assuming username is stored in req.user.username after authentication

  let sql = 'DELETE FROM comments WHERE id = ? AND author = ?';
  db.query(sql, [commentId, author], (err, result) => {
    if (err) {
      console.error('Error deleting comment:', err);
      res.status(500).json({ error: 'Error deleting comment' });
    } else if (result.affectedRows === 0) {
      res.status(403).json({ error: 'Unauthorized' });
    } else {
      res.json({ message: 'Comment deleted successfully' });
    }
  });
});


// Get all vendors
app.get('/api/vendors', (req, res) => {
    const query = 'SELECT vendor_id, vendor_name, company_name, mobile_no FROM vendors';
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching vendors:', error);
            res.status(500).json({ error: 'Failed to fetch vendors' });
            return;
        }
        // Format mobile numbers
        const formattedResults = results.map(result => {
            // Replace spaces with <br> for mobile numbers
            const formattedMobile = result.mobile_no.replace(/\s+/g, '<br>');
            return {
                vendor_id: result.vendor_id,
                vendor_name: result.vendor_name,
                company_name: result.company_name,
                mobile_no: formattedMobile
            };
        });
        res.json(formattedResults);
    });
});

// Add a new vendor
app.post('/api/vendors', (req, res) => {
    const { vendor_name, company_name, mobile_no } = req.body;

    const insertVendorQuery = 'INSERT INTO vendors (vendor_name, company_name, mobile_no) VALUES (?, ?, ?)';
    const values = [vendor_name, company_name, mobile_no];

    db.query(insertVendorQuery, values, (error, results) => {
        if (error) {
            console.error('Error adding vendor:', error);
            res.status(500).json({ error: 'Failed to add vendor' });
            return;
        }
        const vendor_id = results.insertId;
        res.status(201).json({ vendor_id });
    });
});

// Update a vendor by ID
app.put('/api/vendors/:vendorId', (req, res) => {
    const vendorId = req.params.vendorId;
    const { vendor_name, company_name, mobile_no } = req.body;

    const updateVendorQuery = 'UPDATE vendors SET vendor_name = ?, company_name = ?, mobile_no = ? WHERE vendor_id = ?';
    const values = [vendor_name, company_name, mobile_no, vendorId];

    db.query(updateVendorQuery, values, (error, results) => {
        if (error) {
            console.error('Error updating vendor:', error);
            res.status(500).json({ error: 'Failed to update vendor' });
            return;
        }
        if (results.affectedRows === 0) {
            res.status(404).json({ error: 'Vendor not found' });
            return;
        }
        res.status(200).json({ message: 'Vendor updated successfully' });
    });
});

// Get all employees
app.get('/api/employees', (req, res) => {
  const sql = 'SELECT * FROM employees';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error fetching employees:', err);
      res.status(500).json({ error: 'Failed to fetch employees' });
    } else {
      res.json(result);
    }
  });
});

// Get employee by ID
app.get('/api/employees/:id', (req, res) => {
  const employeeId = req.params.id;
  const sql = 'SELECT * FROM employees WHERE id = ?';
  db.query(sql, [employeeId], (err, result) => {
    if (err) {
      console.error('Error fetching employee:', err);
      res.status(500).json({ error: 'Failed to fetch employee' });
    } else if (result.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json(result[0]);
    }
  });
});

// Update employee by ID
app.put('/api/employees/:id', (req, res) => {
  const employeeId = req.params.id;
  const { name, department, contact } = req.body;
  const sql = 'UPDATE employees SET name = ?, department = ?, contact = ? WHERE id = ?';
  db.query(sql, [name, department, contact, employeeId], (err, result) => {
    if (err) {
      console.error('Error updating employee:', err);
      res.status(500).json({ error: 'Failed to update employee' });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json({ message: 'Employee updated successfully' });
    }
  });
});
// Fetch leave requests for a specific employee
app.get('/fetchLeaveRequests/:employeeName', (req, res) => {
    const employeeName = req.params.employeeName;

    const sql = 'SELECT reason, startDate, endDate FROM leave_requests WHERE employeeName = ?';
    db.query(sql, [employeeName], (err, results) => {
        if (err) {
            console.error('Error fetching leave requests:', err);
            res.status(500).send('Error fetching leave requests');
            return;
        }
        res.json(results);
    });
});

// Fetch all employee names
app.get('/employeeNames', (req, res) => {
    const sql = 'SELECT DISTINCT employeeName FROM leave_requests';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching employee names:', err);
            res.status(500).send('Error fetching employee names');
            return;
        }
        res.json(results);
    });
});

// Endpoint to fetch tasks


app.get('/api/tasks', (req, res) => {
  const query = 'SELECT * FROM tasks';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      res.status(500).json({ error: 'Failed to fetch tasks' });
      return;
    }
    res.json(results);
  });
});

// Serve HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'projectwork.html'));
});
app.listen(port, () => {
  console.log(`Server is running on http://192.168.0.121:${port}`);
});
