import { apiClient } from '@/api/client';

export interface MobileCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalSpent: number;
  transactionCount: number;
  createdAt: string;
  lastPaymentAt: string | null;
}

export interface CustomersSummary {
  totalClients: number;
  activeClients: number;
  newClients: number;
}

export interface CustomersResponse {
  success: boolean;
  summary: CustomersSummary;
  customers: MobileCustomer[];
}

export interface CustomerDetailsResponse {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  wallet?: string;
  createdAt: string;
  stats: {
    totalSpent: number;
    totalFees: number;
    transactionCount: number;
    totalTransactions: number;
  };
  payments: any[];
}

class CustomersService {
  async getCustomers(): Promise<CustomersResponse> {
    const response = await apiClient.get<CustomersResponse>('/mobile/customers');
    return response.data;
  }

  async getCustomerDetails(id: string): Promise<CustomerDetailsResponse> {
    const response = await apiClient.get<CustomerDetailsResponse>(`/mobile/customers/${id}`);
    return response.data;
  }
}

export const customersService = new CustomersService();
export default customersService;
