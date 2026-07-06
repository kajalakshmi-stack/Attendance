<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://plain-apac-prod-public.komododecks.com/202607/06/4dxtOcDpX9530vap6pOf/image.png" />
</div>

# To Run this Project

just click the link.

HERE= https://employee-attendance-1018499831756.asia-southeast1.run.app

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`



Project Overview

Company Employee Attendance Management System is a modern web-based application designed to simplify employee attendance tracking and workforce management. It provides a secure platform where administrators can manage employee records, mark daily attendance, monitor attendance history, and generate attendance reports. The system helps organizations replace manual attendance registers with a fast, accurate, and centralized digital solution.

The application is built using React, TypeScript, Express.js, PostgreSQL, Drizzle ORM, Tailwind CSS, and JWT Authentication, providing a secure, responsive, and scalable attendance management platform.

Use Cases
1. Employee Management
Add new employees
Edit employee details
Delete employee records
Search employee information
2. Attendance Management
Mark daily attendance
Update attendance status
View attendance history
Prevent duplicate attendance entries
3. Attendance Monitoring
View present and absent employees
Track attendance percentage
Monitor employee attendance trends
Display attendance statistics
4. Report Generation
Generate daily attendance reports
Generate monthly attendance reports
Export attendance records (if implemented)
View attendance summaries
5. Secure Admin Access
Admin login using JWT authentication
Protected dashboard
Secure session management
6. Dashboard Analytics
Total Employees
Employees Present Today
Employees Absent Today
Overall Attendance Percentage
Attendance Summary Cards
7. Database Management
Store employee details securely
Maintain attendance records
Fast data retrieval using PostgreSQL and Drizzle ORM
Key Features
Secure Admin Login
Employee Registration & Management
Daily Attendance Tracking
Attendance History
Dashboard Analytics
Responsive User Interface
PostgreSQL Database Integration
JWT-Based Authentication
Modern React & TypeScript Frontend
Fast and Scalable Architecture
Benefits
Eliminates manual attendance registers
Reduces human errors
Saves time in attendance management
Provides accurate attendance reports
Improves workforce monitoring
Secure and centralized employee data management
Easy-to-use responsive interface suitable for companies of any size

Technologies Used

The application is built using modern web technologies that work together to provide a secure, responsive, and scalable attendance management system.

1. React (Frontend)

React is a JavaScript library used to build the user interface of the application. It creates interactive and dynamic web pages such as the login page, dashboard, employee list, and attendance management screens. React updates only the required parts of the webpage, making the application faster and improving the user experience.

2. TypeScript

TypeScript is an enhanced version of JavaScript that adds static typing. It helps developers detect errors during development, improves code readability, and makes the application easier to maintain, especially as the project grows.

3. Express.js (Backend)

Express.js is a lightweight web framework for Node.js. It handles all server-side operations such as processing user requests, authenticating administrators, communicating with the database, and returning responses to the frontend.

4. PostgreSQL (Database)

PostgreSQL is a powerful relational database management system used to store and organize application data. It securely stores employee details, attendance records, and administrator login information while ensuring data integrity and reliability.

5. Drizzle ORM

Drizzle ORM is an Object Relational Mapping (ORM) tool that simplifies database operations. Instead of writing complex SQL queries, developers can use TypeScript code to create, read, update, and delete records, making development faster and reducing errors.

6. Tailwind CSS

Tailwind CSS is a utility-first CSS framework used to design the application's interface. It helps create a modern, responsive, and professional-looking layout with less custom CSS code, ensuring the application works well on desktops, tablets, and mobile devices.

7. JWT (JSON Web Token) Authentication

JWT Authentication provides secure access to the application. After a successful admin login, the server generates a secure token that verifies the administrator's identity for future requests. This prevents unauthorized users from accessing protected pages and ensures secure session management.
