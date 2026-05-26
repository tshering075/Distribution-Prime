/**
 * Firebase Migration Utility
 * Helps migrate data from localStorage to Firebase
 */

import { saveDistributor, getAllDistributors } from '../services/firebaseService';
import { getDistributors } from './distributorAuth';

/**
 * Migrate distributors from localStorage to Firebase
 * @returns {Promise<Object>} Migration result with counts
 */
export async function migrateDistributorsToFirebase() {
  try {
    const localDistributors = getDistributors();
    const firebaseDistributors = await getAllDistributors();
    
    // Create a map of existing Firebase distributors by code
    const existingCodes = new Set(firebaseDistributors.map(d => d.code));
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const distributor of localDistributors) {
      try {
        // Skip if already exists in Firebase
        if (existingCodes.has(distributor.code)) {
          skipped++;
          continue;
        }
        
        // Prepare distributor data for Firebase
        const firebaseData = {
          code: distributor.code,
          name: distributor.name,
          region: distributor.region || 'Southern',
          address: distributor.address || '',
          email: distributor.email || '',
          username: distributor.credentials?.username || '',
          target: distributor.target || {
            CSD_PC: 0,
            CSD_UC: 0,
            Water_PC: 0,
            Water_UC: 0
          },
          achieved: distributor.achieved || {
            CSD_PC: 0,
            CSD_UC: 0,
            Water_PC: 0,
            Water_UC: 0
          }
        };
        
        // Note: This will save to Firestore but won't create Firebase Auth accounts
        // Firebase Auth accounts need to be created separately with email/password
        await saveDistributor(firebaseData);
        migrated++;
      } catch (error) {
        console.error(`Error migrating distributor ${distributor.code}:`, error);
        errors++;
      }
    }
    
    return {
      total: localDistributors.length,
      migrated,
      skipped,
      errors
    };
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

/**
 * Check if migration is needed
 * @returns {Promise<boolean>} True if migration is needed
 */
export async function isMigrationNeeded() {
  try {
    const localDistributors = getDistributors();
    const firebaseDistributors = await getAllDistributors();
    
    // Migration is needed if there are local distributors but no Firebase distributors
    // or if there are more local distributors than Firebase
    return localDistributors.length > 0 && 
           (firebaseDistributors.length === 0 || localDistributors.length > firebaseDistributors.length);
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}
