import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { eq, or, and, like, desc, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { admins, employees, attendance, departments, reports, activityLogs } from './src/db/schema.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'attendance-system-secret-key-12345';

app.use(express.json());

// Custom Working Hours Calculator helper
function calculateWorkingHours(checkIn: string, checkOut: string): string {
  try {
    const parseTime = (timeStr: string) => {
      const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (!match) return null;
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const inMin = parseTime(checkIn);
    const outMin = parseTime(checkOut);
    if (inMin === null || outMin === null) return "8h 0m";
    let diff = outMin - inMin;
    if (diff < 0) diff += 24 * 60; // Handle overnight wraps
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  } catch (e) {
    return "8h 0m";
  }
}

// Lazy Seeding Logic
async function seedDatabase() {
  try {
    // 1. Seed Admin
    const adminCount = await db.select().from(admins).limit(1);
    if (adminCount.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await db.insert(admins).values({
        email: 'admin@company.com',
        passwordHash,
      });
      console.log('Admin seeded: admin@company.com / admin123');
    }

    // 2. Seed Departments
    const deptCount = await db.select().from(departments).limit(1);
    if (deptCount.length === 0) {
      await db.insert(departments).values([
        { name: 'Engineering', description: 'Core product development & infrastructure' },
        { name: 'Design', description: 'UI/UX and brand design' },
        { name: 'Sales', description: 'Enterprise sales & client relations' },
        { name: 'HR', description: 'Human resources and recruitment' },
        { name: 'Marketing', description: 'Product marketing and brand campaigns' },
      ]);
      console.log('Departments seeded');
    }

    // 3. Seed Employees
    const empCount = await db.select().from(employees).limit(1);
    if (empCount.length === 0) {
      await db.insert(employees).values([
        {
          employeeId: 'EMP001',
          name: 'John Doe',
          email: 'john.doe@company.com',
          phone: '+1 555-0101',
          department: 'Engineering',
          designation: 'Senior Software Engineer',
          joiningDate: '2024-01-15',
          salary: '$95,000',
          address: '123 Tech Lane, San Francisco, CA',
          status: 'Active',
          photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        },
        {
          employeeId: 'EMP002',
          name: 'Jane Smith',
          email: 'jane.smith@company.com',
          phone: '+1 555-0102',
          department: 'Design',
          designation: 'Lead UI/UX Designer',
          joiningDate: '2024-02-10',
          salary: '$88,000',
          address: '456 Creative Blvd, San Francisco, CA',
          status: 'Active',
          photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        },
        {
          employeeId: 'EMP003',
          name: 'Bob Johnson',
          email: 'bob.johnson@company.com',
          phone: '+1 555-0103',
          department: 'Sales',
          designation: 'Enterprise Account Executive',
          joiningDate: '2024-03-01',
          salary: '$75,000',
          address: '789 Market St, San Francisco, CA',
          status: 'Active',
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        },
        {
          employeeId: 'EMP004',
          name: 'Alice Williams',
          email: 'alice.williams@company.com',
          phone: '+1 555-0104',
          department: 'HR',
          designation: 'HR Director',
          joiningDate: '2023-11-20',
          salary: '$80,000',
          address: '101 People Way, San Francisco, CA',
          status: 'Active',
          photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
        },
        {
          employeeId: 'EMP005',
          name: 'Charlie Brown',
          email: 'charlie.brown@company.com',
          phone: '+1 555-0105',
          department: 'Marketing',
          designation: 'Product Marketing Manager',
          joiningDate: '2024-04-12',
          salary: '$72,000',
          address: '202 Hype St, San Francisco, CA',
          status: 'Active',
          photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
        },
      ]);
      console.log('Employees seeded');
    }

    // 4. Seed Attendance History for last 10 days
    const attCount = await db.select().from(attendance).limit(1);
    if (attCount.length === 0) {
      const dates = [];
      const today = new Date();
      for (let i = 0; i < 10; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        // Format YYYY-MM-DD
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
      }

      const emps = ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005'];
      const statuses: ('Present' | 'Late' | 'Absent' | 'Half Day' | 'Leave')[] = ['Present', 'Late', 'Absent', 'Half Day', 'Leave'];

      for (const dStr of dates) {
        for (const empId of emps) {
          // Semi-randomized attendance
          let status: 'Present' | 'Late' | 'Absent' | 'Half Day' | 'Leave' = 'Present';
          const r = Math.random();
          if (r < 0.7) {
            status = 'Present';
          } else if (r < 0.85) {
            status = 'Late';
          } else if (r < 0.9) {
            status = 'Half Day';
          } else if (r < 0.95) {
            status = 'Leave';
          } else {
            status = 'Absent';
          }

          let checkIn = null;
          let checkOut = null;
          let workingHours = null;

          if (status === 'Present') {
            checkIn = '09:00 AM';
            checkOut = '05:30 PM';
            workingHours = '8h 30m';
          } else if (status === 'Late') {
            checkIn = '10:15 AM';
            checkOut = '05:30 PM';
            workingHours = '7h 15m';
          } else if (status === 'Half Day') {
            checkIn = '09:00 AM';
            checkOut = '01:00 PM';
            workingHours = '4h 0m';
          }

          await db.insert(attendance).values({
            employeeId: empId,
            date: dStr,
            checkIn,
            checkOut,
            workingHours,
            status,
          });
        }
      }
      console.log('Attendance records seeded');
    }

    // 5. Seed initial activity log
    const logCount = await db.select().from(activityLogs).limit(1);
    if (logCount.length === 0) {
      await db.insert(activityLogs).values([
        {
          userEmail: 'admin@company.com',
          action: 'System Seeded',
          details: 'Initialized default employee, department, and attendance database values.',
        },
      ]);
    }
  } catch (error) {
    console.error('Database seeding failed:', error);
  }
}

// ---------------- API ENDPOINTS ----------------

// 1. Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const adminUser = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    if (adminUser.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const matched = await bcrypt.compare(password, adminUser[0].passwordHash);
    if (!matched) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { email: adminUser[0].email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log Activity
    await db.insert(activityLogs).values({
      userEmail: email,
      action: 'Admin Login',
      details: 'Admin logged in successfully.',
    });

    res.json({
      token,
      admin: {
        email: adminUser[0].email,
        role: 'admin',
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// 2. Dashboard Statistics
app.get('/api/dashboard/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch Employees
    const activeEmps = await db.select().from(employees).where(eq(employees.status, 'Active'));
    const totalEmployees = activeEmps.length;

    // Fetch Today's Attendance
    const todayAttendance = await db.select().from(attendance).where(eq(attendance.date, todayStr));

    let presentToday = 0;
    let absentToday = 0;
    let lateToday = 0;
    let leaveToday = 0;

    for (const record of todayAttendance) {
      if (record.status === 'Present') presentToday++;
      else if (record.status === 'Absent') absentToday++;
      else if (record.status === 'Late') lateToday++;
      else if (record.status === 'Leave') leaveToday++;
      else if (record.status === 'Half Day') presentToday++; // Treat half day as present
    }

    // Default missing active employees to Absent
    const markedEmpIds = new Set(todayAttendance.map((a) => a.employeeId));
    const unmarkedActiveCount = activeEmps.filter((e) => !markedEmpIds.has(e.employeeId)).length;
    absentToday += unmarkedActiveCount;

    const attendancePercentage = totalEmployees > 0
      ? Math.round(((presentToday + lateToday) / totalEmployees) * 100)
      : 0;

    // Department Stats
    const deptStatsMap: Record<string, number> = {};
    for (const emp of activeEmps) {
      const dept = emp.department || 'Unassigned';
      deptStatsMap[dept] = (deptStatsMap[dept] || 0) + 1;
    }
    const departmentStats = Object.entries(deptStatsMap).map(([department, count]) => ({
      department,
      count,
    }));

    // Weekly Attendance Trend (last 7 days)
    const weekTrendMap: Record<string, { Present: number; Late: number; Absent: number }> = {};
    const last7DaysAttendance = await db
      .select()
      .from(attendance)
      .orderBy(desc(attendance.date))
      .limit(200);

    // Get unique last 7 dates
    const uniqueDates = Array.from(new Set(last7DaysAttendance.map((a) => a.date)))
      .sort()
      .slice(-7);

    for (const date of uniqueDates) {
      weekTrendMap[date] = { Present: 0, Late: 0, Absent: 0 };
    }

    for (const record of last7DaysAttendance) {
      if (weekTrendMap[record.date]) {
        if (record.status === 'Present') weekTrendMap[record.date].Present++;
        else if (record.status === 'Late') weekTrendMap[record.date].Late++;
        else if (record.status === 'Absent') weekTrendMap[record.date].Absent++;
        else if (record.status === 'Half Day') weekTrendMap[record.date].Present++; // Group Half Day with Present for charts
      }
    }

    const weeklyAttendance = Object.entries(weekTrendMap).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    // Monthly Attendance Trends
    const monthlyAttendance = [
      { month: 'Jan', Present: 92, Late: 5, Absent: 3 },
      { month: 'Feb', Present: 94, Late: 4, Absent: 2 },
      { month: 'Mar', Present: 91, Late: 6, Absent: 3 },
      { month: 'Apr', Present: 95, Late: 3, Absent: 2 },
      { month: 'May', Present: 93, Late: 5, Absent: 2 },
      { month: 'Jun', Present: 96, Late: 2, Absent: 2 },
    ];

    // Employee Growth Stats
    const employeeGrowth = [
      { month: 'Jan', count: 32 },
      { month: 'Feb', count: 34 },
      { month: 'Mar', count: 35 },
      { month: 'Apr', count: 38 },
      { month: 'May', count: 42 },
      { month: 'Jun', count: 45 },
    ];

    // Recent Activity Logs
    const recentLogs = await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(5);

    // Recent Attendance Checks
    const recentAttendance = await db
      .select()
      .from(attendance)
      .orderBy(desc(attendance.createdAt))
      .limit(6);

    // Fetch Employee names for recent attendance
    const allEmps = await db.select().from(employees);
    const empMap = new Map(allEmps.map((e) => [e.employeeId, e.name]));

    const recentAttendanceWithNames = recentAttendance.map((record) => ({
      ...record,
      employeeName: empMap.get(record.employeeId) || 'Unknown Employee',
    }));

    res.json({
      totalEmployees,
      presentToday,
      absentToday,
      lateToday,
      leaveToday,
      attendancePercentage,
      departmentStats,
      weeklyAttendance,
      monthlyAttendance,
      employeeGrowth,
      recentActivity: recentLogs,
      recentAttendance: recentAttendanceWithNames,
    });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// 3. Employee CRUD
app.get('/api/employees', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search, department, status, limit, page } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offsetNum = (pageNum - 1) * limitNum;

    // Filters
    let conditions: any[] = [];
    if (status) {
      conditions.push(eq(employees.status, status as string));
    }
    if (department) {
      conditions.push(eq(employees.department, department as string));
    }

    // Handle search query across ID, Name, and Email
    if (search) {
      const searchStr = `%${search}%`;
      conditions.push(
        or(
          like(employees.name, searchStr),
          like(employees.email, searchStr),
          like(employees.employeeId, searchStr)
        )
      );
    }

    let allFiltered;
    if (conditions.length > 0) {
      allFiltered = await db.select().from(employees).where(and(...conditions));
    } else {
      allFiltered = await db.select().from(employees);
    }

    const total = allFiltered.length;

    // Apply pagination and sorting
    const paginated = allFiltered
      .sort((a, b) => a.employeeId.localeCompare(b.employeeId))
      .slice(offsetNum, offsetNum + limitNum);

    res.json({
      employees: paginated,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: any) {
    console.error('Fetch employees error:', error);
    res.status(500).json({ error: 'Failed to retrieve employees' });
  }
});

app.post('/api/employees', requireAuth, async (req: AuthRequest, res) => {
  try {
    const empData = req.body;

    // Validate inputs
    if (!empData.name || !empData.email) {
      return res.status(400).json({ error: 'Name and email are required fields' });
    }

    // Auto-generate employeeId if not supplied
    if (!empData.employeeId) {
      const existing = await db.select().from(employees);
      const maxId = existing.reduce((max, current) => {
        const idNum = parseInt(current.employeeId.replace('EMP', ''));
        return idNum > max ? idNum : max;
      }, 0);
      empData.employeeId = `EMP${String(maxId + 1).padStart(3, '0')}`;
    }

    const result = await db.insert(employees).values(empData).returning();

    // Log Activity
    await db.insert(activityLogs).values({
      userEmail: req.user?.email || 'admin@company.com',
      action: 'Add Employee',
      details: `Added new employee ${empData.name} (${empData.employeeId})`,
    });

    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: error.message || 'Failed to create employee' });
  }
});

app.put('/api/employees/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const result = await db
      .update(employees)
      .set(updatedData)
      .where(eq(employees.id, parsedId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Log Activity
    await db.insert(activityLogs).values({
      userEmail: req.user?.email || 'admin@company.com',
      action: 'Edit Employee',
      details: `Updated employee details for ${updatedData.name || result[0].name} (${result[0].employeeId})`,
    });

    res.json(result[0]);
  } catch (error: any) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

app.delete('/api/employees/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    // Find first to get name and ID
    const target = await db.select().from(employees).where(eq(employees.id, parsedId)).limit(1);
    if (target.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await db.delete(employees).where(eq(employees.id, parsedId));

    // Log Activity
    await db.insert(activityLogs).values({
      userEmail: req.user?.email || 'admin@company.com',
      action: 'Delete Employee',
      details: `Deleted employee ${target[0].name} (${target[0].employeeId})`,
    });

    res.json({ message: 'Employee successfully deleted', employeeId: target[0].employeeId });
  } catch (error: any) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// 4. Attendance Management
app.get('/api/attendance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date, search, department } = req.query;

    let allAttendance;
    if (date) {
      allAttendance = await db.select().from(attendance).where(eq(attendance.date, date as string));
    } else {
      allAttendance = await db.select().from(attendance);
    }
    const allEmps = await db.select().from(employees);
    const empMap = new Map(allEmps.map((e) => [e.employeeId, e]));

    // Join attendance with employee metadata manually
    let results = allAttendance.map((att) => {
      const emp = empMap.get(att.employeeId);
      return {
        ...att,
        employeeName: emp ? emp.name : 'Unknown Employee',
        department: emp ? emp.department : 'Unassigned',
      };
    });

    // Apply in-memory search and filters to match the employee's department/name
    if (search) {
      const s = (search as string).toLowerCase();
      results = results.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(s) ||
          r.employeeId.toLowerCase().includes(s)
      );
    }

    if (department) {
      results = results.filter((r) => r.department === department);
    }

    res.json(results);
  } catch (error: any) {
    console.error('Fetch attendance error:', error);
    res.status(500).json({ error: 'Failed to retrieve attendance logs' });
  }
});

app.post('/api/attendance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { employeeId, date, checkIn, checkOut, status } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({ error: 'Employee ID, Date, and Status are required' });
    }

    // Calculate working hours if both checkIn and checkOut are provided
    let workingHours = null;
    if (checkIn && checkOut) {
      workingHours = calculateWorkingHours(checkIn, checkOut);
    }

    // Check if record already exists for employee and date
    const existing = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, date)))
      .limit(1);

    let result;
    if (existing.length > 0) {
      result = await db
        .update(attendance)
        .set({ checkIn, checkOut, workingHours, status })
        .where(eq(attendance.id, existing[0].id))
        .returning();
    } else {
      result = await db
        .insert(attendance)
        .values({ employeeId, date, checkIn, checkOut, workingHours, status })
        .returning();
    }

    // Log Activity
    await db.insert(activityLogs).values({
      userEmail: req.user?.email || 'admin@company.com',
      action: 'Mark Attendance',
      details: `Marked ${status} for ${employeeId} on ${date}`,
    });

    res.json(result[0]);
  } catch (error: any) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Failed to save attendance record' });
  }
});

app.post('/api/attendance/bulk', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date, records } = req.body; // records: [{ employeeId, status, checkIn, checkOut }]

    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Date and records array are required' });
    }

    for (const record of records) {
      const { employeeId, status, checkIn, checkOut } = record;
      if (!employeeId || !status) continue;

      let workingHours = null;
      if (checkIn && checkOut) {
        workingHours = calculateWorkingHours(checkIn, checkOut);
      }

      // Upsert
      const existing = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, date)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(attendance)
          .set({ status, checkIn, checkOut, workingHours })
          .where(eq(attendance.id, existing[0].id));
      } else {
        await db.insert(attendance).values({
          employeeId,
          date,
          status,
          checkIn,
          checkOut,
          workingHours,
        });
      }
    }

    // Log Activity
    await db.insert(activityLogs).values({
      userEmail: req.user?.email || 'admin@company.com',
      action: 'Bulk Mark Attendance',
      details: `Saved attendance for ${records.length} employees on ${date}`,
    });

    res.json({ success: true, message: `Successfully saved ${records.length} attendance records` });
  } catch (error: any) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({ error: 'Failed to process bulk attendance' });
  }
});

// 5. Departments
app.get('/api/departments', requireAuth, async (req, res) => {
  try {
    const results = await db.select().from(departments);
    res.json(results);
  } catch (error: any) {
    console.error('Fetch departments error:', error);
    res.status(500).json({ error: 'Failed to retrieve departments' });
  }
});

app.post('/api/departments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const result = await db.insert(departments).values({ name, description }).returning();

    // Log Activity
    await db.insert(activityLogs).values({
      userEmail: req.user?.email || 'admin@company.com',
      action: 'Create Department',
      details: `Created new department: ${name}`,
    });

    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// 6. Reports Generation
app.get('/api/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, date, employeeId, department } = req.query;

    const allEmps = await db.select().from(employees);
    const empMap = new Map(allEmps.map((e) => [e.employeeId, e]));

    let attendanceRecords = await db.select().from(attendance);

    // Filter attendance records by employee/department if supplied
    let filtered = attendanceRecords.map((att) => {
      const emp = empMap.get(att.employeeId);
      return {
        ...att,
        employeeName: emp ? emp.name : 'Unknown Employee',
        department: emp ? emp.department : 'Unassigned',
      };
    });

    if (date) {
      filtered = filtered.filter((r) => r.date === date);
    }
    if (employeeId) {
      filtered = filtered.filter((r) => r.employeeId === employeeId);
    }
    if (department) {
      filtered = filtered.filter((r) => r.department === department);
    }

    res.json({
      type,
      generatedAt: new Date().toISOString(),
      recordCount: filtered.length,
      data: filtered,
    });
  } catch (error: any) {
    console.error('Generate reports error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// 7. Activity Logs
app.get('/api/activity-logs', requireAuth, async (req, res) => {
  try {
    const logs = await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(50);
    res.json(logs);
  } catch (error: any) {
    console.error('Fetch activity logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve activity logs' });
  }
});

// ---------------- VITE / STATIC MIDDLWARE ----------------

async function startServer() {
  // Seed Database in the background
  await seedDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
