import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

// All hardcoded/sample products have been permanently removed per user request.
// Products are exclusively managed manually via Admin Dashboard.
export const INITIAL_PRODUCTS: any[] = [];

export async function seedProductsIfEmpty(_force = false): Promise<number> {
  // Hardcoded seeding disabled permanently
  return 0;
}

