
export enum UserRole {
  RTM = 'RTM',
  TM = 'TM',
  ASSISTANT = 'ASSISTANT',
  FINANCE = 'FINANCE',
  ADMIN = 'ADMIN'
}

export enum RequestStatus {
  PENDING_TM = 'PENDING_TM',
  APPROVED_TM = 'APPROVED_TM',
  PARTIAL_TM = 'PARTIAL_TM',
  REJECTED = 'REJECTED',
  SIGNED = 'SIGNED',
  PAID = 'PAID'
}

export interface Branch {
  id: string;
  name: string;
  regionId: string;
}

export interface Region {
  id: string;
  name: string;
}

export interface PromoType {
  id: string;
  name: string;
}

export interface BranchData {
  branchId: string;
  amount: number;
  promoTypeId: string;
  comment: string;
}

export interface MarketingRequest {
  id: string;
  createdAt: string;
  rtmId: string;
  rtmName: string;
  regionId: string;
  branches: BranchData[];
  status: RequestStatus;
  approvedAmount?: number;
  tmComment?: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  regionId?: string | string[];
  password?: string;
}
