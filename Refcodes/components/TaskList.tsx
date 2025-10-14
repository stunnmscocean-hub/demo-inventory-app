import React, { useState, useEffect, useCallback } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import { fetchTasks as apiFetchTasks } from '../services/api'; // api.ts에서 fetchTasks를 가져옴

interface Task {
  ID: string;
  Title: string;
  Description: string;
  Status: string;
  Assignee: string;
  CreatedAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface TaskListProps {
  auth: {
    isAuthenticated: boolean;
    user: User | null;
  };
  onLogout: () => void;
  onLogin: (user: any) => void;
}

const TaskList: React.FC<TaskListProps> = ({ auth, onLogout, onLogin }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('All'); // State for filtering by status

  const allStatuses = ['All', '완료', '진행 중', '대기 중']; // Possible statuses from the sheet

  const fetchTasks = useCallback(async (userEmail: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching tasks with email:', userEmail); // 디버깅을 위해 추가
      const data: Task[] = await apiFetchTasks(userEmail);
      setTasks(data);
    } catch (err: any) {
      console.error("Error fetching tasks:", err);
      setError(`Failed to fetch tasks: ${err.message}`);
      setTasks([]); // 에러 발생 시 태스크 목록 초기화
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.email) {
      fetchTasks(auth.user.email);
    } else {
      setLoading(false);
      setTasks([]);
    }
  }, [auth.isAuthenticated, auth.user?.email, fetchTasks]);

  // Filter tasks based on selected status
  const filteredTasks = tasks.filter(task =>
    selectedStatus === 'All' || task.Status === selectedStatus
  );

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(event.target.value);
  };

  const handleLogout = () => {
    onLogout();
    setTasks([]);
    setError(null);
  };

  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    console.log('Google Login Succeeded:', credentialResponse);

    if (credentialResponse.credential) {
      const decodedToken: { email: string, name: string, picture: string } = jwtDecode(credentialResponse.credential);
      
      console.log('Decoded User Info:', decodedToken);
      
      onLogin({ 
        email: decodedToken.email, 
        name: decodedToken.name, 
        picture: decodedToken.picture 
      });
    }
  };

  const handleLoginError = () => {
    console.log('Login Failed');
  };

  // 인증되지 않은 경우 로그인 UI 표시
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h2>Google 로그인이 필요합니다</h2>
          <GoogleLogin
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Task List</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Welcome, {auth.user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status:
            </label>
            <select 
              id="statusFilter" 
              value={selectedStatus} 
              onChange={handleStatusChange}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          {filteredTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tasks found for the selected status.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTasks.map((task) => (
                    <tr key={task.ID} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.ID}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.Title}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{task.Description}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          task.Status === '완료' ? 'bg-green-100 text-green-800' :
                          task.Status === '진행 중' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {task.Status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.Assignee}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.CreatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskList;
