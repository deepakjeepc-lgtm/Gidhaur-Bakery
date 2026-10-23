import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Clock,
  PackageCheck,
  ChefHat,
  Bike,
  XCircle,
  Trash2,
  Phone,
  MapPin,
  FileText,
  Receipt,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { getLocalDateString } from '../../services/orderArchiveService';

interface OrderHistoryViewProps {
  archivedOrders: Order[];
  onDeleteArchivedOrder: (orderId: string) => void;
  onClearAllHistory?: () => void;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = React.memo(({
  archivedOrders,
  onDeleteArchivedOrder
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Helper date calculations
  const now = new Date();
  const todayStr = getLocalDateString(now);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayDate);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return archivedOrders.filter((order) => {
      const q = searchQuery.trim().toLowerCase();
      const oId = String(order.orderId || order.id || '').toLowerCase();
      const cName = String(order.customerName || '').toLowerCase();
      const cPhone = String(order.phone || '').replace(/\D/g, '');
      const cleanQ = q.replace(/\D/g, '');

      const matchesSearch =
        !q ||
        oId.includes(q) ||
        cName.includes(q) ||
        (cleanQ && cPhone.includes(cleanQ));

      if (!matchesSearch) return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'delivered' && order.status !== 'delivered') return false;
        if (statusFilter === 'pending' && (order.status === 'delivered' || order.status === 'rejected')) return false;
        if (statusFilter === 'in_progress' && !['accepted', 'preparing', 'out_for_delivery'].includes(order.status)) return false;
        if (statusFilter === 'rejected' && order.status !== 'rejected') return false;
      }

      if (dateFilter !== 'all') {
        const orderDate = new Date(order.createdAt || 0);
        const orderDateStr = getLocalDateString(orderDate);

        if (dateFilter === 'today' && orderDateStr !== todayStr) return false;
        if (dateFilter === 'yesterday' && orderDateStr !== yesterdayStr) return false;
        if (dateFilter === 'week' && orderDate < sevenDaysAgo) return false;
      }

      return true;
    });
  }, [archivedOrders, searchQuery, statusFilter, dateFilter, todayStr, yesterdayStr, sevenDaysAgo]);

  // Aggregate metrics
  const { totalArchivedCount, deliveredCount, unhandledPastCount, totalRevenue } = useMemo(() => {
    let delivered = 0;
    let unhandled = 0;
    let rev = 0;
    for (let i = 0; i < archivedOrders.length; i++) {
      const o = archivedOrders[i];
      if (o.status === 'delivered') {
        delivered++;
        rev += o.totalAmount || 0;
      } else if (o.status !== 'rejected') {
        unhandled++;
      }
    }
    return {
      totalArchivedCount: archivedOrders.length,
      deliveredCount: delivered,
      unhandledPastCount: unhandled,
      totalRevenue: rev,
    };
  }, [archivedOrders]);

  const formatDateTime = (dateVal: any) => {
    try {
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/40">
            <PackageCheck className="w-3 h-3 text-[#10B981]" /> DELIVERED
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#121212] text-[#FFFFFF] border border-[#3F3F46]">
            <Bike className="w-3 h-3 text-[#FF5500]" /> DISPATCHED
          </span>
        );
      case 'preparing':
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#121212] text-[#FF5500] border border-[#FF5500]/40">
            <ChefHat className="w-3 h-3 text-[#FF5500]" /> IN KITCHEN
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/40 line-through">
            <XCircle className="w-3 h-3 text-[#EF4444]" /> CANCELLED
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#121212] text-[#F59E0B] border border-[#F59E0B]/40">
            <Clock className="w-3 h-3 text-[#F59E0B]" /> PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric Summary Cards — Pure Matte Black Editorial */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] block">
            TOTAL ARCHIVED ORDERS
          </span>
          <div className="font-mono font-bold text-2xl text-[#FFFFFF] tabular-nums tracking-[0.06em]">
            {totalArchivedCount}
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] block">
            TOTAL DELIVERED
          </span>
          <div className="font-mono font-bold text-2xl text-[#10B981] tabular-nums tracking-[0.06em]">
            {deliveredCount}
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] block">
            ROLLED OVER / UNFINISHED
          </span>
          <div className="font-mono font-bold text-2xl text-[#F59E0B] tabular-nums tracking-[0.06em]">
            {unhandledPastCount}
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] block">
            ARCHIVED REVENUE
          </span>
          <div className="font-mono font-bold text-2xl text-[#FF5500] tabular-nums tracking-[0.06em]">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#18181B] border border-[#27272A] p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-[#27272A] pb-3">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] border shrink-0 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                  : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
              }`}
            >
              ALL ({totalArchivedCount})
            </button>

            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-3 py-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] border shrink-0 cursor-pointer ${
                statusFilter === 'delivered'
                  ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                  : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
              }`}
            >
              DELIVERED ({deliveredCount})
            </button>

            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] border shrink-0 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                  : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
              }`}
            >
              ROLLED OVER ({unhandledPastCount})
            </button>

            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] border shrink-0 cursor-pointer ${
                statusFilter === 'rejected'
                  ? 'bg-[#EF4444] text-[#FFFFFF] border-[#EF4444]'
                  : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#EF4444]'
              }`}
            >
              CANCELLED
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
            <input
              type="text"
              placeholder="SEARCH ID, CUSTOMER, PHONE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#121212] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none uppercase tracking-[0.1em]"
            />
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] shrink-0 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#71717A]" /> DATE RANGE:
          </span>
          <div className="inline-flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1 border text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] cursor-pointer ${
                dateFilter === 'all'
                  ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'border-[#27272A] bg-[#121212] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
              }`}
            >
              ALL
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1 border text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] cursor-pointer ${
                dateFilter === 'today'
                  ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'border-[#27272A] bg-[#121212] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
              }`}
            >
              TODAY
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`px-2.5 py-1 border text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] cursor-pointer ${
                dateFilter === 'yesterday'
                  ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'border-[#27272A] bg-[#121212] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
              }`}
            >
              YESTERDAY
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('week')}
              className={`px-2.5 py-1 border text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] cursor-pointer ${
                dateFilter === 'week'
                  ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'border-[#27272A] bg-[#121212] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
              }`}
            >
              7 DAYS
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#18181B] border border-[#27272A] p-12 text-center space-y-2">
          <div className="w-9 h-9 bg-[#121212] text-[#71717A] border border-[#27272A] mx-auto flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <h3 className="font-mono text-xs uppercase tracking-[0.06em] text-[#A1A1AA]">
            No Historical Orders Found
          </h3>
          <p className="text-xs text-[#71717A]">Try adjusting your filters or date selection</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const totalItemsCount = order.items.reduce((s, i) => s + i.quantity, 0);

            return (
              <div
                key={order.id}
                className="bg-[#18181B] hover:bg-[#1E1E1E] border border-[#27272A] hover:border-[#3F3F46] p-4 space-y-3 [content-visibility:auto] [contain-intrinsic-size:120px]"
              >
                {/* Top Row: Customer Name, Order ID Tag, Amount, Delete & Expand Buttons */}
                <div className="flex items-center justify-between gap-3 border-b border-[#27272A] pb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#FFFFFF] truncate tracking-normal leading-normal">
                      {order.customerName}
                    </h3>
                    <span className="font-mono text-[11px] font-bold tabular-nums tracking-[0.06em] px-2 py-0.5 bg-[#121212] text-[#A1A1AA] border border-[#27272A] shrink-0">
                      #{order.orderId || order.id}
                    </span>
                  </div>

                  {/* Right: Amount + Delete Button + Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-base text-[#FFFFFF] tabular-nums tracking-[0.06em]">
                      ₹{order.totalAmount}
                    </span>

                    <button
                      type="button"
                      onClick={() => setOrderToDelete(order)}
                      className="w-7 h-7 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#EF4444] flex items-center justify-center cursor-pointer shrink-0"
                      title="Delete Permanently from History"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="w-7 h-7 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer shrink-0"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Second Row: Phone, Date, Status, Payment, Items Count */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A1A1AA]">
                  <a
                    href={`tel:${order.phone}`}
                    className="inline-flex items-center gap-1 text-[#FFFFFF] hover:text-[#FF5500] font-mono font-bold tabular-nums tracking-[0.06em] text-[11px] bg-[#121212] px-2 py-0.5 border border-[#27272A]"
                  >
                    <Phone className="w-3 h-3 text-[#71717A]" />
                    <span>{order.phone}</span>
                  </a>

                  <span className="inline-flex items-center gap-1 text-[11px] text-[#71717A] font-mono font-bold tabular-nums tracking-[0.06em]">
                    <Clock className="w-3 h-3 text-[#71717A]" />
                    <span>{formatDateTime(order.createdAt)}</span>
                  </span>

                  <div className="shrink-0">
                    {getStatusBadge(order.status)}
                  </div>

                  <span className="px-2 py-0.5 font-mono font-bold uppercase text-[10px] sm:text-[11px] tracking-[0.14em] bg-[#121212] text-[#A1A1AA] border border-[#27272A]">
                    {order.paymentMethod === 'upi' ? 'UPI' : 'CASH'}
                  </span>

                  <span className="text-[11px] text-[#71717A] font-mono font-bold tabular-nums tracking-[0.06em]">
                    · {totalItemsCount} {totalItemsCount === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                </div>

                {/* Items Summary Box */}
                <div className="bg-[#121212] p-3 border border-[#27272A] space-y-1.5 text-xs">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[#A1A1AA]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-[#FFFFFF] bg-[#18181B] px-1.5 py-0.5 border border-[#27272A] text-[11px] shrink-0">
                          {item.quantity}x
                        </span>
                        <span className="text-[#FFFFFF] truncate">{item.name}</span>
                        {item.selectedSize && (
                          <span className="text-[10px] text-[#71717A] font-mono uppercase shrink-0">({item.selectedSize})</span>
                        )}
                        {item.selectedExtras && item.selectedExtras.length > 0 && (
                          <span className="text-[10px] text-[#A1A1AA] font-mono bg-[#18181B] px-1 py-0.5 border border-[#27272A] shrink-0">
                            +{item.selectedExtras.map(e => e.name).join(', ')}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-semibold text-[#FFFFFF] shrink-0 ml-2">₹{item.price * item.quantity}</span>
                    </div>
                  ))}

                  {order.address && (
                    <div className="pt-2 border-t border-[#27272A] text-[11px] text-[#A1A1AA] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                      <span className="truncate">{order.address}</span>
                    </div>
                  )}
                </div>

                {/* Collapsible item details */}
                {isExpanded && (
                  <div className="pt-2 border-t border-[#27272A] space-y-3 text-xs">
                    {order.notes && (
                      <p className="text-[11px] text-[#FFFFFF] bg-[#121212] p-2.5 border border-[#27272A]">
                        <strong className="text-[#FF5500] font-mono uppercase">Note:</strong> {order.notes}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setReceiptOrder(order)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] text-[11px] font-mono font-semibold uppercase tracking-[0.06em] cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>View Printable Receipt</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#27272A] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#71717A] block">
                  ORDER RECEIPT
                </span>
                <h3 className="font-bold text-base text-[#FFFFFF] uppercase tracking-[-0.02em]">
                  Gidhaur Bakery
                </h3>
              </div>
              <button
                onClick={() => setReceiptOrder(null)}
                className="w-7 h-7 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#27272A]">
                <span className="text-[#71717A] font-mono uppercase">Order ID:</span>
                <span className="font-mono font-bold text-[#FFFFFF]">#{receiptOrder.orderId || receiptOrder.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#27272A]">
                <span className="text-[#71717A] font-mono uppercase">Date &amp; Time:</span>
                <span className="font-mono text-[#A1A1AA]">{formatDateTime(receiptOrder.createdAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#27272A]">
                <span className="text-[#71717A] font-mono uppercase">Customer:</span>
                <span className="text-[#FFFFFF] font-semibold">{receiptOrder.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#27272A]">
                <span className="text-[#71717A] font-mono uppercase">Phone:</span>
                <span className="font-mono text-[#FFFFFF]">{receiptOrder.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#27272A]">
                <span className="text-[#71717A] font-mono uppercase">Address:</span>
                <span className="text-[#A1A1AA] text-right max-w-[200px] truncate">{receiptOrder.address}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#27272A]">
                <span className="text-[#71717A] font-mono uppercase">Payment:</span>
                <span className="font-mono uppercase text-[#FFFFFF]">{receiptOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#27272A]">
                <span className="text-[#71717A] font-mono uppercase">Status:</span>
                <span>{getStatusBadge(receiptOrder.status)}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">Items</span>
              <div className="bg-[#121212] border border-[#27272A] p-3 space-y-1.5 text-xs">
                {receiptOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-[#A1A1AA]">
                    <span className="text-[#FFFFFF]">{item.quantity}x {item.name}</span>
                    <span className="font-mono font-semibold text-[#FFFFFF]">₹{item.price * item.quantity}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#27272A] flex justify-between font-bold text-sm text-[#FFFFFF]">
                  <span className="font-mono uppercase text-xs">Grand Total:</span>
                  <span className="font-mono text-[#FF5500]">₹{receiptOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-semibold text-[11px] uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Print / Save Receipt
            </button>
          </div>
        </div>
      )}

      {/* Delete Single Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#27272A] max-w-sm w-full p-6 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#EF4444] block">
                PERMANENT DELETION
              </span>
              <h3 className="font-bold text-base text-[#FFFFFF]">
                Delete Order #{orderToDelete.orderId || orderToDelete.id}?
              </h3>
              <p className="text-xs text-[#A1A1AA]">This action cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] text-[11px] font-mono uppercase tracking-[0.06em] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteArchivedOrder(orderToDelete.orderId || orderToDelete.id);
                  setOrderToDelete(null);
                }}
                className="flex-1 py-2 bg-[#EF4444] hover:bg-red-600 text-[#FFFFFF] text-[11px] font-mono font-semibold uppercase tracking-[0.06em] cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
