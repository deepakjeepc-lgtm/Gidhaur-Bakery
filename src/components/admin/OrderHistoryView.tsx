import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Clock,
  PackageCheck,
  ChefHat,
  Bike,
  XCircle,
  AlertCircle,
  Trash2,
  Eye,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Receipt,
  Download,
  Filter,
  CheckCircle2,
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

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  archivedOrders,
  onDeleteArchivedOrder
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'yesterday' | 'week'>('all');
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

      // Search match
      const matchesSearch =
        !q ||
        oId.includes(q) ||
        cName.includes(q) ||
        (cleanQ && cPhone.includes(cleanQ));

      if (!matchesSearch) return false;

      // Status match
      if (statusFilter !== 'all') {
        if (statusFilter === 'delivered' && order.status !== 'delivered') return false;
        if (statusFilter === 'pending' && order.status !== 'pending') return false;
        if (statusFilter === 'in_progress' && !['accepted', 'preparing', 'out_for_delivery'].includes(order.status)) return false;
        if (statusFilter === 'rejected' && order.status !== 'rejected') return false;
      }

      // Date match
      if (dateFilter !== 'all') {
        const orderDate = new Date(order.createdAt || 0);
        const orderDateStr = getLocalDateString(orderDate);

        if (dateFilter === 'yesterday' && orderDateStr !== yesterdayStr) return false;
        if (dateFilter === 'week' && orderDate < sevenDaysAgo) return false;
      }

      return true;
    });
  }, [archivedOrders, searchQuery, statusFilter, dateFilter, yesterdayStr, sevenDaysAgo]);

  // Aggregate metrics
  const totalArchivedCount = archivedOrders.length;
  const deliveredCount = archivedOrders.filter((o) => o.status === 'delivered').length;
  const unhandledPastCount = archivedOrders.filter((o) => o.status !== 'delivered' && o.status !== 'rejected').length;
  const totalRevenue = archivedOrders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <PackageCheck className="w-3 h-3 text-emerald-600" /> Delivered
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Bike className="w-3 h-3 text-purple-600" /> Out for Delivery
          </span>
        );
      case 'preparing':
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <ChefHat className="w-3 h-3 text-amber-600" /> In Kitchen
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-500" /> Past Day Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            TOTAL PAST ORDERS
          </span>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
            {totalArchivedCount}
          </div>
          <span className="text-[10px] text-slate-400 block font-medium">All archived orders</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            TOTAL DELIVERED
          </span>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-700">
            {deliveredCount}
          </div>
          <span className="text-[10px] text-emerald-600/80 block font-medium">Completed orders</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
            UNPROCESSED PAST
          </span>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-amber-700">
            {unhandledPastCount}
          </div>
          <span className="text-[10px] text-amber-600/80 block font-medium">Archived at date rollover</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-4 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            HISTORICAL REVENUE
          </span>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 block font-medium">Delivered sales</span>
        </div>
      </div>

      {/* Filter and Search Bar: Clean capsule controls in a single unified card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({totalArchivedCount})
            </button>

            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === 'delivered'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Delivered ({deliveredCount})
            </button>

            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending ({unhandledPastCount})
            </button>

            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === 'rejected'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cancelled
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID, name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 text-slate-900 transition-colors"
            />
          </div>
        </div>

        {/* Date Filter: Capsule look with exact ALL, YASTERDAY, 7 DAY options */}
        <div className="flex items-center gap-2.5 pt-2.5 border-t border-slate-100 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date:
          </span>
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-full border border-slate-200/80 gap-1 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                dateFilter === 'all'
                  ? 'bg-slate-950 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              ALL
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                dateFilter === 'yesterday'
                  ? 'bg-slate-950 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              YASTERDAY
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('week')}
              className={`px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                dateFilter === 'week'
                  ? 'bg-slate-950 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              7 DAY
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-extrabold text-base text-slate-800">
            No Historical Orders Found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all' || dateFilter !== 'all'
              ? 'No archived orders match your current search or date filters.'
              : 'As each day ends, all completed and previous day orders automatically transfer here to keep the active daily queue clean!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const totalItemsCount = order.items.reduce((s, i) => s + i.quantity, 0);

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all overflow-hidden p-4 sm:p-5 space-y-3"
              >
                {/* Top Row: Customer Name, Order ID Tag, Amount, Delete & Expand Buttons strictly in one row */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-950 truncate">
                      {order.customerName}
                    </h3>
                    <span className="font-mono font-extrabold text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/80 shrink-0">
                      #{order.orderId || order.id}
                    </span>
                  </div>

                  {/* Right: Amount + Delete Button + Chevron perfectly centered in one row */}
                  <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                    <span className="font-heading font-extrabold text-base sm:text-xl text-slate-950 tracking-tight leading-none">
                      ₹{order.totalAmount}
                    </span>

                    <button
                      type="button"
                      onClick={() => setOrderToDelete(order)}
                      className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Delete from History"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Second Row: Phone, Date, Status, Payment, Items Count (Natural wrap, NO horizontal scroll!) */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <a
                    href={`tel:${order.phone}`}
                    className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-950 font-semibold bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/70 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{order.phone}</span>
                  </a>

                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDateTime(order.createdAt)}</span>
                  </span>

                  <div className="shrink-0">
                    {getStatusBadge(order.status)}
                  </div>

                  <span className="px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wide bg-slate-100 text-slate-700 border border-slate-200/60">
                    {order.paymentMethod === 'upi' ? 'UPI' : 'CASH'}
                  </span>

                  <span className="text-[11px] text-slate-500 font-medium">
                    • {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Items Summary Box */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100/90 space-y-1.5 text-xs">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200/60 text-[11px] shrink-0">
                          {item.quantity}x
                        </span>
                        <span className="font-medium text-slate-800 truncate">{item.name}</span>
                        {item.selectedSize && (
                          <span className="text-[10px] text-slate-400 font-semibold shrink-0">({item.selectedSize})</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">₹{item.price * item.quantity}</span>
                    </div>
                  ))}

                  {order.address && (
                    <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{order.address}</span>
                    </div>
                  )}
                </div>

                {/* Collapsible item details */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100 space-y-3 animate-fadeIn text-xs">
                    {order.notes && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                        <strong>Note:</strong> {order.notes}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setReceiptOrder(order)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  GB
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-900">
                    Gidhaur Bakery
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Order Receipt</p>
                </div>
              </div>
              <button
                onClick={() => setReceiptOrder(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Order ID:</span>
                <span className="font-mono font-bold text-slate-900">#{receiptOrder.orderId || receiptOrder.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Date & Time:</span>
                <span className="text-slate-800 font-medium">{formatDateTime(receiptOrder.createdAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Customer:</span>
                <span className="text-slate-800 font-bold">{receiptOrder.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-800">{receiptOrder.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Address:</span>
                <span className="text-slate-800 text-right max-w-[200px] truncate">{receiptOrder.address}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Payment:</span>
                <span className="font-bold uppercase text-slate-800">{receiptOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status:</span>
                <span>{getStatusBadge(receiptOrder.status)}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Items</span>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
                {receiptOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-mono font-bold">₹{item.price * item.quantity}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm text-slate-900">
                  <span>Grand Total:</span>
                  <span>₹{receiptOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Print / Save Receipt
            </button>
          </div>
        </div>
      )}

      {/* Delete Single Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200 text-center animate-scaleUp">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Delete Historical Order?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Order <strong>#{orderToDelete.orderId || orderToDelete.id}</strong> will be permanently removed from history.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteArchivedOrder(orderToDelete.orderId || orderToDelete.id);
                  setOrderToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
