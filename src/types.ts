export type DepartmentCode = string;

export interface DepartmentInfo {
  code: string;
  fullName: string;
  color: string;
}

export interface CustomStatus {
  key: string;
  label: string;
  description: string;
  colorTheme: 'emerald' | 'amber' | 'blue' | 'sky' | 'purple' | 'rose' | 'slate' | 'indigo';
}

export interface CustomInvestmentStage {
  key: string;
  label: string;
  description: string;
  colorTheme: 'amber' | 'blue' | 'emerald' | 'purple' | 'rose' | 'sky' | 'slate' | 'indigo';
  iconType?: 'search' | 'file' | 'signature' | 'hammer' | 'clock' | 'check' | 'layers';
}

export interface SystemSettings {
  fiscalYear: string;
  appTitle: string;
  appSubtitle: string;
  availableFiscalYears?: string[];
  logoType?: 'icon' | 'image';
  logoUrl?: string;
  logoIcon?: 'building' | 'landmark' | 'briefcase' | 'bar-chart' | 'coins' | 'shield' | 'award' | 'file-text';
  logoColor?: string;
}

export type StatusCategory = 
  | 'approved'           // สงป.อนุมัติแล้ว
  | 'under_review'       // อยู่ระหว่างพิจารณา (สงป.)
  | 'signed_pending'     // รัฐมนตรีลงนามแล้ว - รอดำเนินการส่ง สงป.
  | 'returned_review'    // ส่งเรื่องคืนให้ไปทบทวน
  | 'disapproved'        // ที่ประชุมไม่เห็นชอบ
  | 'draft_pending';       // รอดำเนินการ / คำขอใหม่

export type DisbursementStatus = 
  | 'not_started'   // ยังไม่เริ่มเบิกจ่าย
  | 'in_progress'   // อยู่ระหว่างเบิกจ่าย
  | 'completed'     // เบิกจ่ายครบถ้วน (100%)
  | 'delayed';      // ล่าช้ากว่าแผน

export type ExpenseType = 
  | 'operating'     // งบดำเนินงาน
  | 'investment'    // งบลงทุน
  | 'both';         // มีทั้งงบดำเนินงานและงบลงทุน

export type InvestmentStage = 
  | 'procuring'     // หาผู้รับจ้าง
  | 'bidding'       // ประกวดราคา
  | 'signed'        // ลงนามในสัญญา
  | string;         // หรือขั้นตอนที่ผู้ใช้กำหนดเองในระบบ

export interface DisbursementRecord {
  id: string;
  disbursedDate: string;           // วันที่เบิกจ่าย (e.g., '15 ม.ค. 2569')
  amount: number;                  // จำนวนเงินที่เบิกจ่าย (บาท)
  periodOrMilestone: string;       // งวดที่ / รายการเบิกจ่าย
  docReference?: string;           // เลขที่เอกสาร / ฎีกาเบิกเงิน
  note?: string;                   // หมายเหตุ
  expenseCategory?: 'operating' | 'investment'; // ประเภทงวดงาน
  createdAt?: string;              // วันที่สร้างรายการ
  updatedAt?: string;              // วันที่อัปเดตล่าสุด
}

export interface ProjectItem {
  id: number;                          // ลำดับ
  fiscalYear?: string;                 // ปีงบประมาณ (พ.ศ.) e.g., '2568', '2569', '2570' (รอบ 1 ต.ค. - 30 ก.ย.)
  meetingNo: string;                   // ประชมครั้งที่ (e.g., '12/2568', '1/2569', 'ไม่ได้จัดประชุม')
  title: string;                       // โครงการ
  departmentCode: DepartmentCode;     // หน่วยงานรับผิดชอบ
  departmentName: string;             // ชื่อเต็มหน่วยงาน
  requestedBudget: number;            // ขอรับจัดสรร (บาท)
  ministerSignedDate: string | null;  // รัฐมนตรีลงนาม
  bbApprovedDate?: string | null;     // สงป. อนุมัติ (วันที่)
  approvedBudget: number | null;      // สงป.อนุมัติ (บาท)
  approvedStatusText: string;          // ข้อความในช่อง สงป.อนุมัติ
  remarks: string;                     // หมายเหตุ
  statusCategory: StatusCategory;     // สถานะสำหรับจัดกลุ่มใน dashboard

  // ฟิลด์ประเภทการเบิกจ่ายและงบประมาณตามประเภท
  expenseType?: ExpenseType;           // 1.งบดำเนินงาน 2.งบลงทุน หรือทั้งสองประเภท
  operatingBudget?: number;           // ช่องใส่งบดำเนินงาน (บาท)
  investmentBudget?: number;          // ช่องใส่งบลงทุน (บาท)
  investmentStage?: InvestmentStage | null; // ตัวเลือกย่อยงบลงทุน: หาผู้รับจ้าง, ประกวดราคา, ลงนามในสัญญา

  // ฟิลด์สำหรับระบบติดตามการเบิกจ่าย (Disbursement Tracking)
  disbursedAmount?: number;            // ยอดเบิกจ่ายรวมสะสม (บาท)
  physicalProgress?: number;           // ความคืบหน้าโครงการเชิงกายภาพ (ร้อยละ 0-100)
  disbursementStatus?: DisbursementStatus; // สถานะการเบิกจ่าย
  contractDate?: string | null;        // วันที่ลงนามสัญญา/ผูกพันงบประมาณ
  projectDeadline?: string | null;     // กำหนดแล้วเสร็จ/สิ้นสุดสัญญา
  disbursementRecords?: DisbursementRecord[]; // ประวัติรายการเบิกจ่ายแต่ละงวด
  trackingNotes?: string;              // บันทึกติดตามผลการดำเนินงานล่าสุด

  // ฟิลด์บันทึกประวัติวันเวลา
  createdAt?: string;                  // วันที่สร้างโครงการ
  updatedAt?: string;                  // วันที่บันทึก/แก้ไขข้อมูลล่าสุด
  lastModifiedBy?: string;             // ผู้บันทึก/แก้ไข
}

export interface TrackingFilterState {
  searchQuery: string;
  fiscalYearFilter?: string;        // 'all' | '2568' | '2569' | '2570'
  departmentFilter: string;
  disbursementStatusFilter: string; // 'all' | DisbursementStatus
  expenseTypeFilter: string;        // 'all' | 'operating' | 'investment' | 'procuring' | 'bidding' | 'signed'
  sortBy: 'id' | 'approvedBudget' | 'disbursedAmount' | 'disbursementRate' | 'physicalProgress' | 'title';
  sortDirection: 'asc' | 'desc';
}

export type ActiveTab = 'overview' | 'tracking';

export interface FilterState {
  searchQuery: string;
  fiscalYearFilter: string;         // 'all' | '2568' | '2569' | '2570'
  meetingFilter: string;
  departmentFilter: string;
  statusFilter: string;
  sortBy: 'id' | 'requestedBudget' | 'approvedBudget' | 'title';
  sortDirection: 'asc' | 'desc';
}

export interface KpiSummary {
  totalRequestedBudget: number;
  totalApprovedBudget: number;
  totalUnderReviewBudget: number;
  totalReturnedBudget: number;
  totalPendingBudget: number;
  totalProjects: number;
  approvedProjectsCount: number;
  underReviewProjectsCount: number;
  returnedProjectsCount: number;
  pendingProjectsCount: number;
  draftPendingProjectsCount: number;
  approvalRatePercentage: number;
}
