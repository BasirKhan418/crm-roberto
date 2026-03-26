"use client"

import { useState } from "react"
import { 
  BarChart3, 
  Users, 
  Package, 
  StickyNote, 
  UserCircle,
  Plus,
  LogOut,
  Search,
  Bell,
  Settings,
  MoreVertical,
  ChevronRight,
  TrendingUp,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const [activeTab, setActiveTab ] = useState("Dashboard")

  const sidebarLinks = [
    { icon: BarChart3, label: "Dashboard" },
    { icon: Users, label: "Clients" },
    { icon: Package, label: "Suppliers" },
    { icon: StickyNote, label: "Notes" },
    { icon: UserCircle, label: "Profile" },
  ]

  const stats = [
    { 
      label: "TOTAL CLIENTS", 
      value: "1,284", 
      change: "+ 12%", 
      trend: "up",
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50"
    },
    { 
      label: "TOTAL SUPPLIERS", 
      value: "412", 
      status: "Stable",
      icon: Package,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50"
    },
    { 
      label: "NOTES CREATED THIS WEEK", 
      value: "86", 
      badge: "New Focus",
      icon: StickyNote,
      iconColor: "text-white",
      iconBg: "bg-blue-900",
      dark: true
    }
  ]

  const activities = [
    {
      title: "New client Global Logistics Ltd added to directory",
      subtitle: "System Audit • Managed by Sarah Chen",
      time: "2 mins ago",
      type: "client",
      color: "bg-blue-600"
    },
    {
      title: "Supplier contract updated for Quantum Steel Co.",
      subtitle: "Compliance Check • Automated Registry",
      time: "14 mins ago",
      type: "supplier",
      color: "bg-orange-400",
      isHighlighted: true
    },
    {
      title: "Internal Note: Q4 Revenue Projections revised...",
      subtitle: "Executive Briefing • Managed by Mark Jenkins",
      time: "1 hour ago",
      type: "note",
      color: "bg-blue-600"
    },
    {
      title: "Flagged: Payment delay from Apex Solutions",
      subtitle: "Financial Operations • Urgent Review",
      time: "2 hours ago",
      type: "alert",
      color: "bg-red-500"
    },
    {
      title: "New client Northern Star Inc. onboarding completed",
      subtitle: "Customer Success • Account Setup",
      time: "3 hours ago",
      type: "client",
      color: "bg-blue-600"
    },
    {
      title: "Restocked: Critical supplies from Mainstream Packaging",
      subtitle: "Inventory Management • Automated",
      time: "5 hours ago",
      type: "supplier",
      color: "bg-orange-300"
    },
    {
      title: "Note pinned to Strategy 2025 dashboard",
      subtitle: "Editorial Control • System Admin",
      time: "7 hours ago",
      type: "note",
      color: "bg-blue-600"
    }
  ]

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] bg-[#001e3c] flex flex-col shrink-0 h-full overflow-hidden">
        <div className="p-8 pb-12">
          <h1 className="text-xl font-bold text-white tracking-tight">Executive CRM</h1>
          <p className="text-[10px] text-blue-400 font-bold tracking-[0.2em] mt-1 uppercase opacity-80">Editorial Management</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {sidebarLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => setActiveTab(link.label)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-lg transition-all text-sm font-semibold",
                activeTab === link.label 
                  ? "bg-blue-600/10 text-white border-l-4 border-blue-500 rounded-l-none -ml-4 pl-8" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <link.icon className={cn("h-5 w-5", activeTab === link.label ? "text-white" : "text-zinc-500")} />
              {link.label}
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto space-y-4">
          <Button className="w-full h-12 bg-blue-400 hover:bg-blue-500 text-[#001e3c] font-bold rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-500/20">
            <Plus className="h-4 w-4 stroke-[3px]" />
            Create New
          </Button>
          <button className="flex items-center gap-3 px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold group w-full">
            <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-[#F8FAFC] border-b border-zinc-200/50 flex items-center justify-between px-10 shrink-0">
          <div className="max-w-md w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search entries..." 
              className="pl-12 h-11 bg-zinc-200/30 border-transparent rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500 transition-all text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-6">
            <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-zinc-200/50 transition-colors relative">
              <Bell className="h-5 w-5 text-zinc-600" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-orange-500 rounded-full border-2 border-[#F8FAFC]" />
            </button>
            <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-zinc-200/50 transition-colors">
              <Settings className="h-5 w-5 text-zinc-600" />
            </button>
            <div className="h-8 w-px bg-zinc-200 mx-2" />
            <Button size="sm" className="bg-[#001e3c] hover:bg-[#002850] text-white rounded-lg px-6 h-10 font-bold shadow-md flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Note
            </Button>
            <div className="h-10 w-10 rounded-xl bg-zinc-300 overflow-hidden border-2 border-white shadow-sm shrink-0">
              <img src="https://ui-avatars.com/api/?name=User&background=6366f1&color=fff" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-10 space-y-12">
          {/* Welcome Section */}
          <div>
            <h2 className="text-4xl font-extrabold text-[#001e3c] tracking-tight mb-2">Executive Overview</h2>
            <p className="text-zinc-500 font-medium text-lg">Welcome back. Here is your business narrative for the week of Oct 24th.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {stats.map((stat, i) => (
              <div 
                key={i} 
                className={cn(
                  "p-8 rounded-3xl relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 group",
                  stat.dark ? "bg-[#001e3c] text-white" : "bg-white border border-zinc-100 shadow-sm"
                )}
              >
                <div className="flex items-center justify-between mb-8">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12", stat.iconBg)}>
                    <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
                  </div>
                  {stat.change && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-black tracking-wider">
                      <TrendingUp className="h-3 w-3" />
                      {stat.change}
                    </div>
                  )}
                  {stat.status && (
                    <div className="px-4 py-1.5 bg-zinc-50 text-zinc-400 rounded-full text-[11px] font-black tracking-wider border border-zinc-100">
                      {stat.status}
                    </div>
                  )}
                  {stat.badge && (
                    <div className="px-4 py-1.5 bg-blue-800 text-blue-200 rounded-full text-[11px] font-black tracking-wider">
                      {stat.badge}
                    </div>
                  )}
                </div>
                <div>
                  <div className={cn("text-5xl font-black tracking-tighter mb-2", stat.dark ? "text-white" : "text-[#001e3c]")}>
                    {stat.value}
                  </div>
                  <div className={cn("text-[10px] font-black tracking-[0.2em] uppercase opacity-60", stat.dark ? "text-blue-200" : "text-zinc-400")}>
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Lower Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            {/* Activity Feed */}
            <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-2xl font-bold text-[#001e3c]">Recent Activity</h3>
                <button className="text-sm font-bold text-blue-800 hover:underline">View Historical Archive</button>
              </div>
              
              <div className="space-y-3">
                {activities.map((activity, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "group p-5 rounded-2xl flex items-center gap-6 transition-all hover:scale-[1.01] cursor-pointer",
                      activity.isHighlighted ? "bg-zinc-100/80 border-zinc-200" : "hover:bg-zinc-50 border-transparent"
                    )}
                  >
                    <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", activity.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-[#001e3c] truncate tracking-tight">
                        {activity.title.split(activity.type === 'client' || activity.type === 'supplier' ? 'Ltd' : '...')[0]}
                        <span className="italic font-extrabold opacity-90 mx-1">{activity.title.split(' ').find(w => w.includes('Ltd') || w.includes('Co.') || w.includes('Inc.'))}</span>
                        {activity.title.split(activity.title.split(' ').find(w => w.includes('Ltd') || w.includes('Co.') || w.includes('Inc.')) || '')[1]}
                      </p>
                      {/* Note: Logic above is a bit messy to replicate the bolding in photo, simplifying for better rendering */}
                      <p className="text-[15px] font-bold text-[#001e3c] tracking-tight">{activity.title}</p>
                      <p className="text-[11px] font-semibold text-zinc-400 flex items-center gap-2 mt-0.5 uppercase tracking-wide">
                        {activity.subtitle}
                      </p>
                    </div>
                    <div className="text-[11px] font-bold text-zinc-400 whitespace-nowrap">
                      {activity.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar Cards */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-zinc-100/50 p-8 rounded-3xl border border-zinc-200/50 space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Quick Actions</h4>
                <div className="space-y-3">
                  {[
                    { label: "Client", icon: Users },
                    { label: "Supplier", icon: Package },
                    { label: "Note", icon: StickyNote },
                  ].map((action) => (
                    <button 
                      key={action.label}
                      className="w-full h-16 bg-white border border-zinc-100 rounded-2xl px-6 flex items-center justify-between group hover:shadow-md transition-all active:scale-95"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-zinc-50 rounded-xl flex items-center justify-center">
                          <action.icon className="h-5 w-5 text-[#001e3c]" />
                        </div>
                        <span className="text-sm font-extrabold text-[#001e3c]">+ {action.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Intelligence Card */}
              <div className="relative rounded-3xl overflow-hidden aspect-[4/3] group cursor-pointer shadow-xl">
                <img 
                  src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800" 
                  alt="Market Intelligence" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                <div className="absolute inset-0 p-8 flex flex-col">
                  <div className="text-[10px] font-black text-white/60 tracking-[0.3em] uppercase mb-auto">Market Intelligence</div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white leading-tight">
                      Real Estate & Tech sectors show 4% surge in client activity this quarter.
                    </h3>
                    <button className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors group/btn">
                      Read Analysis
                      <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
