import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Search, Filter, ChevronRight, User, TrendingUp, Users, Plus } from 'lucide-react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { useCustomers } from '@/hooks/useCustomers';
import { MobileCustomer } from '@/services/customers';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { FilterBottomSheet, CustomerFilterOption } from '@/components/customers/FilterBottomSheet';
import { AddActionSheet } from '@/components/customers/AddActionSheet';

export default function CustomersScreen() {
  const router = useRouter();
  const { merchant } = useAuthStore();
  const { data: dashboardData } = useDashboardSummary();
  const { data, isLoading, refetch, isRefetching, isError } = useCustomers();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CustomerFilterOption>('ALL');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const formatAmount = useCallback((amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'C';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    let result = data.customers;

    // Search filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.email && c.email.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q))
      );
    }

    // Category filter
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();

    switch (activeFilter) {
      case 'ACTIVE':
        result = result.filter(c => c.lastPaymentAt && new Date(c.lastPaymentAt).getTime() >= thirtyDaysAgo);
        break;
      case 'NEW':
        result = result.filter(c => new Date(c.createdAt).getTime() >= thirtyDaysAgo);
        break;
      case 'HIGHEST_VOLUME':
        result = [...result].sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case 'MOST_RECENT':
        result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'OLDEST':
        result = [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'HAS_EMAIL':
        result = result.filter(c => !!c.email);
        break;
      case 'HAS_PHONE':
        result = result.filter(c => !!c.phone);
        break;
      default:
        // 'ALL'
        break;
    }

    return result;
  }, [data?.customers, searchQuery, activeFilter]);

  const renderCustomerItem = useCallback(({ item }: { item: MobileCustomer }) => {
    return (
      <TouchableOpacity 
        style={styles.customerItem}
        onPress={() => router.push(`/customers/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.customerIconContainer}>
          <Text style={styles.customerIconText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.customerContent}>
          <Text style={styles.customerName} numberOfLines={1}>{item.name}</Text>
          {item.phone && <Text style={styles.customerSubtitle}>{item.phone}</Text>}
          {item.email && <Text style={styles.customerSubtitle} numberOfLines={1}>{item.email}</Text>}
        </View>
        <View style={styles.customerRight}>
          <Text style={styles.customerAmount}>
            HTG {formatAmount(item.totalSpent)}
          </Text>
          <Text style={styles.customerTxCount}>
            Total transactions
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.transactionCount}</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  }, [formatAmount, router]);

  const ListHeader = useMemo(() => {
    const summary = data?.summary || { totalClients: 0, activeClients: 0, newClients: 0 };
    return (
      <View style={styles.content}>
        <View style={styles.pageHeader}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Clients</Text>
              <Text style={styles.pageSubtitle}>Gérez vos clients et suivez leurs activités</Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => setIsAddModalVisible(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 122, 0, 0.1)',
                justifyContent: 'center',
                alignItems: 'center',
                marginLeft: 16,
              }}
            >
              <Plus size={24} color="#FF7A00" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un client..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setIsFilterModalVisible(true)}
          >
            <Filter size={20} color={activeFilter !== 'ALL' ? '#FF7A00' : '#9CA3AF'} />
            {activeFilter !== 'ALL' && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <User size={20} color="#FF7A00" />
              <Text style={styles.statNumber}>{summary.totalClients}</Text>
            </View>
            <Text style={styles.statLabel}>Total clients</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <TrendingUp size={20} color="#22C55E" />
              <Text style={styles.statNumber}>{summary.activeClients}</Text>
            </View>
            <Text style={styles.statLabel}>Clients actifs</Text>
            <Text style={styles.statPeriod}>30 derniers jours</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <Users size={20} color="#FF7A00" />
              <Text style={styles.statNumber}>{summary.newClients}</Text>
            </View>
            <Text style={styles.statLabel}>Nouveaux clients</Text>
            <Text style={styles.statPeriod}>30 derniers jours</Text>
          </View>
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Liste des clients</Text>
          <TouchableOpacity onPress={() => setIsFilterModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.filterTextLabel}>
              {FILTER_OPTIONS_MAP[activeFilter] || 'Plus récents'}
            </Text>
            <ChevronRight size={16} color="#FF7A00" style={{ transform: [{ rotate: '90deg' }] }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [data?.summary, searchQuery, activeFilter]);

  const ListEmpty = useMemo(() => {
    if (isLoading && !isRefetching) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.secondaryText}>Chargement des clients...</Text>
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.secondaryText}>Erreur lors du chargement. Veuillez réessayer.</Text>
          <TouchableOpacity onPress={onRefresh} style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <Text style={{ color: '#FFFFFF' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Aucun client trouvé.</Text>
        <Text style={styles.secondaryText}>Vos clients apparaîtront ici après leurs premiers paiements.</Text>
      </View>
    );
  }, [isLoading, isRefetching, isError, onRefresh]);

  const unreadCount = dashboardData?.unreadNotifications || 0;

  return (
    <View style={styles.container}>
      <DashboardHeader 
        merchant={merchant as any} 
        unreadCount={unreadCount} 
        onNotificationPress={() => router.push('/(modals)/notifications')}
      />

      <View style={{ flex: 1 }}>
        <FlashList
          data={filteredCustomers}
          renderItem={renderCustomerItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor="#FF7A00"
              colors={['#FF7A00']}
            />
          }
        />
      </View>

      <FilterBottomSheet 
        visible={isFilterModalVisible}
        selectedFilter={activeFilter}
        onSelect={setActiveFilter}
        onClose={() => setIsFilterModalVisible(false)}
      />

      <AddActionSheet 
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
      />
    </View>
  );
}

const FILTER_OPTIONS_MAP: Record<CustomerFilterOption, string> = {
  ALL: 'Tous les clients',
  ACTIVE: 'Clients actifs',
  NEW: 'Nouveaux clients',
  HIGHEST_VOLUME: 'Volume max',
  MOST_RECENT: 'Plus récents',
  OLDEST: 'Plus anciens',
  HAS_EMAIL: 'Avec email',
  HAS_PHONE: 'Avec téléphone',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B18',
  },
  content: {
    padding: 16,
  },
  pageHeader: {
    marginBottom: 20,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pageSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF7A00',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  statPeriod: {
    color: '#6B7280',
    fontSize: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterTextLabel: {
    color: '#FF7A00',
    fontSize: 14,
    marginRight: 4,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#101827',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  customerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerIconText: {
    color: '#FF7A00',
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerContent: {
    flex: 1,
    marginRight: 8,
  },
  customerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  customerSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 1,
  },
  customerRight: {
    alignItems: 'flex-end',
  },
  customerAmount: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  customerTxCount: {
    color: '#9CA3AF',
    fontSize: 10,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  badgeText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  secondaryText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  }
});
