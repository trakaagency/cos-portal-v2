'use client'

import { useState, useEffect } from 'react'
import { Activity, Users, Trash2, Eye } from 'lucide-react'

interface UserActivity {
  userId: string
  email: string
  lastActive: string
  sessionDuration?: string
  totalArtists: number
  deletedArtists: number
  pendingArtists: number
  processingArtists: number
  approvedArtists: number
  artists: Array<{
    id: string
    name: string
    status: string
    createdAt: string
    deletedAt?: string
    grossSalary?: string
  }>
}

interface MonthlyStats {
  month: string
  year: number
  totalArtists: number
  pendingArtists: number
  processingArtists: number
  approvedArtists: number
  deletedArtists: number
  activeUsers: number
  totalSessions: number
  averageSessionDuration: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserActivity[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [userDetails, setUserDetails] = useState<UserActivity | null>(null)

  useEffect(() => {
    fetchUserActivity()
  }, [])

  const fetchUserActivity = async () => {
    try {
      setLoading(true)
      const [usersResponse, monthlyResponse] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/monthly-stats')
      ])
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users)
      } else {
        console.error('Failed to fetch user activity')
      }
      
      if (monthlyResponse.ok) {
        const monthlyData = await monthlyResponse.json()
        setMonthlyStats(monthlyData.monthlyStats)
      } else {
        console.error('Failed to fetch monthly stats')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const viewUserDetails = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setUserDetails(data.user)
        setSelectedUser(userId)
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
      case 'processing': return 'bg-blue-500/20 border-blue-500/40 text-blue-300'
      case 'approved': return 'bg-green-500/20 border-green-500/40 text-green-300'
      default: return 'bg-gray-500/20 border-gray-500/40 text-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-white text-lg">Loading admin data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-[#43ffa4]" />
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          </div>
          <div className="text-sm text-gray-400">
            {users.length} active users
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-[#43ffa4]" />
              <h3 className="text-sm font-semibold text-white">Total Users</h3>
            </div>
            <div className="text-2xl font-bold text-white">{users.length}</div>
          </div>
          
          <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-[#43ffa4]" />
              <h3 className="text-sm font-semibold text-white">Total Artists</h3>
            </div>
            <div className="text-2xl font-bold text-white">
              {users.reduce((sum, user) => sum + user.totalArtists, 0)}
            </div>
          </div>
          
          <div className="bg-[#332740] border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 bg-yellow-500 rounded-full"></div>
              <h3 className="text-sm font-semibold text-white">Pending Artists</h3>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {users.reduce((sum, user) => sum + user.pendingArtists, 0)}
            </div>
          </div>
          
          <div className="bg-[#332740] border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 bg-blue-500 rounded-full"></div>
              <h3 className="text-sm font-semibold text-white">Processing Artists</h3>
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {users.reduce((sum, user) => sum + user.processingArtists, 0)}
            </div>
          </div>
          
          <div className="bg-[#332740] border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 bg-green-500 rounded-full"></div>
              <h3 className="text-sm font-semibold text-white">Approved Artists</h3>
            </div>
            <div className="text-2xl font-bold text-green-400">
              {users.reduce((sum, user) => sum + user.approvedArtists, 0)}
            </div>
          </div>
          
          <div className="bg-[#332740] border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              <h3 className="text-sm font-semibold text-white">Deleted Artists</h3>
            </div>
            <div className="text-2xl font-bold text-red-400">
              {users.reduce((sum, user) => sum + user.deletedArtists, 0)}
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-6">Monthly Statistics</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Month</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Total Artists</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Pending</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Processing</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Approved</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Deleted</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Active Users</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Sessions</th>
                  <th className="text-center py-3 px-4 text-gray-300 font-medium">Avg Session</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((stat, index) => (
                  <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4 text-white font-medium">
                      {stat.month} {stat.year}
                    </td>
                    <td className="py-3 px-4 text-center text-white">{stat.totalArtists}</td>
                    <td className="py-3 px-4 text-center text-yellow-400">{stat.pendingArtists}</td>
                    <td className="py-3 px-4 text-center text-blue-400">{stat.processingArtists}</td>
                    <td className="py-3 px-4 text-center text-green-400">{stat.approvedArtists}</td>
                    <td className="py-3 px-4 text-center text-red-400">{stat.deletedArtists}</td>
                    <td className="py-3 px-4 text-center text-white">{stat.activeUsers}</td>
                    <td className="py-3 px-4 text-center text-white">{stat.totalSessions}</td>
                    <td className="py-3 px-4 text-center text-gray-300">{stat.averageSessionDuration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">User Activity</h2>
          
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.userId} className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                                         <div className="flex items-center gap-4 mb-2">
                       <h3 className="text-lg font-semibold text-white">{user.email}</h3>
                       <div className="flex flex-col text-sm text-gray-400">
                         <span>Last sign-in: {new Date(user.lastActive).toLocaleString()}</span>
                         <span>Session duration: {user.sessionDuration || 'Unknown'}</span>
                       </div>
                     </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Total Artists:</span>
                        <span className="text-white ml-2">{user.totalArtists}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Pending:</span>
                        <span className="text-yellow-400 ml-2">{user.pendingArtists}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Processing:</span>
                        <span className="text-blue-400 ml-2">{user.processingArtists}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Approved:</span>
                        <span className="text-green-400 ml-2">{user.approvedArtists}</span>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <span className="text-gray-400">Deleted Artists:</span>
                      <span className="text-red-400 ml-2">{user.deletedArtists}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => viewUserDetails(user.userId)}
                    className="btn-gradient btn-small"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Details Modal */}
        {selectedUser && userDetails && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  User Details: {userDetails.email}
                </h2>
                <button
                  onClick={() => {
                    setSelectedUser(null)
                    setUserDetails(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Artists:</span>
                      <span className="text-white">{userDetails.totalArtists}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pending:</span>
                      <span className="text-yellow-400">{userDetails.pendingArtists}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Processing:</span>
                      <span className="text-blue-400">{userDetails.processingArtists}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Approved:</span>
                      <span className="text-green-400">{userDetails.approvedArtists}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Deleted:</span>
                      <span className="text-red-400">{userDetails.deletedArtists}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Active:</span>
                      <span className="text-white">{new Date(userDetails.lastActive).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">User ID:</span>
                      <span className="text-white font-mono text-xs">{userDetails.userId}</span>
                    </div>
                  </div>
                </div>
              </div>
              
                               <div className="bg-gray-800/50 rounded-lg p-4">
                   <h3 className="text-lg font-semibold text-white mb-4">Artist List</h3>
                   <div className="space-y-2 max-h-60 overflow-y-auto">
                     {userDetails.artists.map((artist) => (
                       <div key={artist.id} className="flex items-center justify-between p-2 bg-gray-700/30 rounded">
                         <div className="flex-1">
                           <div className="flex items-center justify-between">
                             <span className="text-white">{artist.name}</span>
                             <div className="flex items-center gap-2">
                               {artist.grossSalary && (
                                 <span className="text-green-400 text-xs font-medium">
                                   £{artist.grossSalary}
                                 </span>
                               )}
                               <div className={`px-2 py-1 rounded text-xs ${getStatusColor(artist.status)}`}>
                                 {artist.status}
                               </div>
                             </div>
                           </div>
                           <span className="text-gray-400 text-xs">
                             {artist.deletedAt ? `Deleted: ${new Date(artist.deletedAt).toLocaleDateString()}` : `Created: ${new Date(artist.createdAt).toLocaleDateString()}`}
                           </span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 