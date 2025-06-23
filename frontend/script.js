// Global variables
let currentUser = null;
let tasks = [];
let users = [];
let notifications = [];
let selectedTasks = new Set();

// API Base URL
const API_BASE = 'http://localhost:3000';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
    loadUsers();
});

// Setup event listeners
function setupEventListeners() {
    // Authentication forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Task forms
    document.getElementById('taskForm').addEventListener('submit', handleCreateTask);
    document.getElementById('editTaskForm').addEventListener('submit', handleEditTask);
    
    // User management
    document.getElementById('userForm').addEventListener('submit', handleCreateUser);
    
    // Comments
    document.getElementById('addCommentForm').addEventListener('submit', handleAddComment);
    
    // Modal close events
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            showMainApp();
            closeLoginModal();
            showNotification('Login successful!', 'success');
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password, role })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Registration successful! Please login.', 'success');
            closeRegisterModal();
            showLoginModal();
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    showAuthSection();
    showNotification('Logged out successfully', 'info');
}

// Modal functions
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginForm').reset();
}

function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'block';
}

function closeRegisterModal() {
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('registerForm').reset();
}

function showEditTaskModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskDueDate').value = task.due_date;
    document.getElementById('editTaskStatus').value = task.status;
    
    // Populate assignee dropdown before setting the value
    populateAssigneeDropdown('editTaskAssignee');
    document.getElementById('editTaskAssignee').value = task.assignee_id;
    
    document.getElementById('editTaskModal').style.display = 'block';
}

function closeEditTaskModal() {
    document.getElementById('editTaskModal').style.display = 'none';
    document.getElementById('editTaskForm').reset();
}

function showCommentsModal(taskId) {
    document.getElementById('commentTaskId').value = taskId;
    loadComments(taskId);
    document.getElementById('commentsModal').style.display = 'block';
}

function closeCommentsModal() {
    document.getElementById('commentsModal').style.display = 'none';
    document.getElementById('addCommentForm').reset();
}

function showNotificationsModal() {
    document.getElementById('notificationsModal').style.display = 'block';
}

function closeNotificationsModal() {
    document.getElementById('notificationsModal').style.display = 'none';
}

function showUserManagementModal() {
    if (currentUser && currentUser.role === 'admin') {
        document.getElementById('userManagementModal').style.display = 'block';
        loadUsers();
    } else {
        showNotification('Access denied. Only administrators can manage users.', 'error');
    }
}

function closeUserManagementModal() {
    document.getElementById('userManagementModal').style.display = 'none';
    document.getElementById('userForm').reset();
}

// Task functions
async function handleCreateTask(e) {
    e.preventDefault();
    
    const assigneeValue = document.getElementById('taskAssignee').value;
    if (!assigneeValue) {
        showNotification('Please select an assignee.', 'error');
        return;
    }
    const assignee_id = Number(assigneeValue);
    if (isNaN(assignee_id)) {
        showNotification('Invalid assignee selected.', 'error');
        return;
    }
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        assignee_id: assignee_id,
        status: document.getElementById('taskStatus').value,
        due_date: document.getElementById('taskDueDate').value,
        priority: document.getElementById('taskPriority').value
    };
    try {
        const response = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(taskData)
        });
        const data = await response.json();
        if (response.ok) {
            showNotification('Task created successfully!', 'success');
            document.getElementById('taskForm').reset();
            loadTasks();
        } else {
            showNotification(data.message || 'Failed to create task', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

async function handleEditTask(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('editTaskId').value;
    const taskData = {
        title: document.getElementById('editTaskTitle').value,
        description: document.getElementById('editTaskDescription').value,
        priority: document.getElementById('editTaskPriority').value,
        due_date: document.getElementById('editTaskDueDate').value,
        assignee_id: document.getElementById('editTaskAssignee').value,
        status: document.getElementById('editTaskStatus').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(taskData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Task updated successfully!', 'success');
            closeEditTaskModal();
            loadTasks();
        } else {
            showNotification(data.message || 'Failed to update task', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            showNotification('Task deleted successfully!', 'success');
            loadTasks();
        } else {
            const data = await response.json();
            showNotification(data.message || 'Failed to delete task', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

async function loadTasks() {
    try {
        const response = await fetch(`${API_BASE}/tasks`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            tasks = await response.json();
            displayTasks();
            updateTaskStats();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function displayTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    tasks.forEach(task => {
        const li = document.createElement('li');
        const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed';
        const isCompleted = task.status === 'completed';
        
        if (isCompleted) li.classList.add('completed');
        if (isOverdue) li.classList.add('overdue');
        
        // Use assignee_name from backend response
        const assigneeName = task.assignee_name || 'Unassigned';
        
        li.innerHTML = `
            <div class="task-header">
                <input type="checkbox" class="task-checkbox" onchange="toggleTaskSelection(${task.id})">
                <strong>${task.title}</strong>
            </div>
            ${task.description ? `<p>${task.description}</p>` : ''}
            <div class="task-meta">
                <span class="priority-${task.priority.toLowerCase()}">${task.priority}</span>
                <span>Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                <span>Status: ${task.status.replace('_', ' ').charAt(0).toUpperCase() + task.status.slice(1)}</span>
            </div>
            <div class="assignee">Assigned to: ${assigneeName}</div>
            <div class="task-actions">
                <button onclick="showEditTaskModal(${task.id})" class="edit-btn">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="showCommentsModal(${task.id})" class="comments-btn">
                    <i class="fas fa-comments"></i> Comments
                </button>
                <button onclick="deleteTask(${task.id})" class="delete-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        taskList.appendChild(li);
    });
}

function updateTaskStats() {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => new Date(t.due_date) < new Date() && t.status !== 'completed').length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('inProgressCount').textContent = inProgress;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('overdueCount').textContent = overdue;
}

// User management functions
async function handleCreateUser(e) {
    e.preventDefault();
    
    const userData = {
        username: document.getElementById('userUsername').value,
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value,
        role: document.getElementById('userRole').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('User created successfully!', 'success');
            document.getElementById('userForm').reset();
            loadUsers();
        } else {
            showNotification(data.message || 'Failed to create user', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            users = await response.json();
            //console.log('Users loaded:', users);
            populateAssigneeDropdowns();
            displayUsers();
        } else {
            const errorText = await response.text();
            console.error('Failed to load users:', response.status, errorText);
            showNotification(`Failed to load users: ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('An error occurred while loading users. See console.', 'error');
    }
}

function populateAssigneeDropdowns() {
    const assigneeSelects = ['taskAssignee', 'filterAssignee'];
    
    assigneeSelects.forEach(selectId => {
        populateAssigneeDropdown(selectId);
    });
}

function populateAssigneeDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (select) {
        //console.log(`Populating dropdown: ${selectId}`);
        const currentVal = select.value;
        select.innerHTML = '<option value="">Select User</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            select.appendChild(option);
        });
        if (currentVal) {
            select.value = currentVal;
        }
    }
}

function displayUsers() {
    const userList = document.getElementById('userList');
    if (!userList) return;
    
    userList.innerHTML = '';
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${user.username} (${user.role})</span>
            <div class="user-actions">
                <button onclick="editUser(${user.id})" class="edit-user-btn">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteUser(${user.id})" class="delete-user-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        userList.appendChild(li);
    });
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            showNotification('User deleted successfully!', 'success');
            loadUsers();
        } else {
            const data = await response.json();
            showNotification(data.message || 'Failed to delete user', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

function clearUserForm() {
    document.getElementById('userForm').reset();
}

// Comments functions
async function handleAddComment(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('commentTaskId').value;
    const text = document.getElementById('commentText').value;
    
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ text })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Comment added successfully!', 'success');
            document.getElementById('addCommentForm').reset();
            loadComments(taskId);
        } else {
            showNotification(data.message || 'Failed to add comment', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

async function loadComments(taskId) {
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}/comments`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const comments = await response.json();
            displayComments(comments);
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = '';
    
    comments.forEach(comment => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <div class="comment-meta">${comment.username} - ${new Date(comment.created_at).toLocaleString()}</div>
                <div>${comment.comment}</div>
            </div>
            <div class="comment-actions">
                <button onclick="deleteComment(${comment.id})" class="delete-comment-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        commentsList.appendChild(li);
    });
}

async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            showNotification('Comment deleted successfully!', 'success');
            const taskId = document.getElementById('commentTaskId').value;
            loadComments(taskId);
        } else {
            const data = await response.json();
            showNotification(data.message || 'Failed to delete comment', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

// Filter and search functions
function applyFilters() {
    const status = document.getElementById('filterStatus').value;
    const priority = document.getElementById('filterPriority').value;
    const assignee = document.getElementById('filterAssignee').value;
    const dueDate = document.getElementById('filterDueDate').value;
    const search = document.getElementById('searchTasks').value.toLowerCase();
    
    const filteredTasks = tasks.filter(task => {
        const matchesStatus = !status || task.status === status;
        const matchesPriority = !priority || task.priority === priority;
        const matchesAssignee = !assignee || task.assignee_id == assignee;
        const matchesDueDate = !dueDate || task.due_date === dueDate;
        const matchesSearch = !search ||
            (typeof task.title === 'string' && task.title.toLowerCase().includes(search)) ||
            (typeof task.description === 'string' && task.description.toLowerCase().includes(search));
        
        return matchesStatus && matchesPriority && matchesAssignee && matchesDueDate && matchesSearch;
    });
    
    displayFilteredTasks(filteredTasks);
}

function displayFilteredTasks(filteredTasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed';
        const isCompleted = task.status === 'completed';
        
        if (isCompleted) li.classList.add('completed');
        if (isOverdue) li.classList.add('overdue');
        
        const assignee = users.find(u => u.id === task.assignee_id);
        const assigneeName = assignee ? assignee.username : 'Unknown';
        
        li.innerHTML = `
            <div class="task-header">
                <input type="checkbox" class="task-checkbox" onchange="toggleTaskSelection(${task.id})">
                <strong>${task.title}</strong>
            </div>
            ${task.description ? `<p>${task.description}</p>` : ''}
            <div class="task-meta">
                <span class="priority-${task.priority.toLowerCase()}">${task.priority}</span>
                <span>Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                <span>Status: ${task.status.replace('_', ' ').charAt(0).toUpperCase() + task.status.slice(1)}</span>
            </div>
            <div class="assignee">Assigned to: ${assigneeName}</div>
            <div class="task-actions">
                <button onclick="showEditTaskModal(${task.id})" class="edit-btn">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="showCommentsModal(${task.id})" class="comments-btn">
                    <i class="fas fa-comments"></i> Comments
                </button>
                <button onclick="deleteTask(${task.id})" class="delete-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        taskList.appendChild(li);
    });
}

function clearFilters() {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPriority').value = '';
    document.getElementById('filterAssignee').value = '';
    document.getElementById('filterDueDate').value = '';
    document.getElementById('searchTasks').value = '';
    displayTasks();
}

// Bulk actions
function toggleTaskSelection(taskId) {
    if (selectedTasks.has(taskId)) {
        selectedTasks.delete(taskId);
    } else {
        selectedTasks.add(taskId);
    }
    
    updateBulkActionsBar();
}

function updateBulkActionsBar() {
    const bulkBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');
    const bulkActionBtn = document.getElementById('bulkActionBtn');
    
    if (selectedTasks.size > 0) {
        bulkBar.style.display = 'flex';
        selectedCount.textContent = selectedTasks.size;
        bulkActionBtn.disabled = false;
    } else {
        bulkBar.style.display = 'none';
    }
}

function performBulkAction() {
    const action = document.getElementById('bulkAction').value;
    if (!action) return;
    
    const taskIds = Array.from(selectedTasks);
    
    switch (action) {
        case 'complete':
            bulkUpdateStatus(taskIds, 'completed');
            break;
        case 'delete':
            bulkDeleteTasks(taskIds);
            break;
        case 'assign':
            // Implement bulk assign functionality
            showNotification('Bulk assign feature coming soon!', 'info');
            break;
    }
}

async function bulkUpdateStatus(taskIds, status) {
    try {
        const response = await fetch(`${API_BASE}/tasks/bulk-status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ taskIds, status })
        });
        
        if (response.ok) {
            showNotification('Tasks updated successfully!', 'success');
            clearSelection();
            loadTasks();
        } else {
            const data = await response.json();
            showNotification(data.message || 'Failed to update tasks', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

async function bulkDeleteTasks(taskIds) {
    if (!confirm(`Are you sure you want to delete ${taskIds.length} tasks?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/tasks/bulk-delete`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ taskIds })
        });
        
        if (response.ok) {
            showNotification('Tasks deleted successfully!', 'success');
            clearSelection();
            loadTasks();
        } else {
            const data = await response.json();
            showNotification(data.message || 'Failed to delete tasks', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

function clearSelection() {
    selectedTasks.clear();
    updateBulkActionsBar();
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
}

// Notifications
async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE}/notifications`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            notifications = await response.json();
            displayNotifications();
            updateNotificationCount();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function displayNotifications() {
    const notificationsList = document.getElementById('notificationsList');
    notificationsList.innerHTML = '';
    
    notifications.forEach(notification => {
        const li = document.createElement('li');
        if (!notification.read) li.classList.add('unread');
        
        li.innerHTML = `
            <div>
                <div>${notification.message}</div>
                <div class="notification-meta">${new Date(notification.created_at).toLocaleString()}</div>
            </div>
            <button onclick="markNotificationAsRead(${notification.id})" class="mark-read-btn">
                <i class="fas fa-check"></i>
            </button>
        `;
        notificationsList.appendChild(li);
    });
}

function updateNotificationCount() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const countElement = document.getElementById('notificationCount');
    const bellElement = document.querySelector('.notification-bell');
    
    if (unreadCount > 0) {
        countElement.textContent = unreadCount;
        bellElement.classList.add('has-unread');
    } else {
        bellElement.classList.remove('has-unread');
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        const response = await fetch(`${API_BASE}/notifications/read-all`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// Utility functions
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentUser = JSON.parse(user);
        showMainApp();
    } else {
        showAuthSection();
    }
}

function showMainApp() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainAppContent').style.display = 'block';
    
    // Update user info
    document.getElementById('userInfo').textContent = `Welcome, ${currentUser.username}!`;
    
    // Show/hide admin features
    if (currentUser.role === 'admin') {
        document.getElementById('manageUsersBtn').style.display = 'block';
    } else {
        document.getElementById('manageUsersBtn').style.display = 'none';
    }
    
    // Load data
    loadTasks();
    loadNotifications();
}

function showAuthSection() {
    document.getElementById('mainAppContent').style.display = 'none';
    document.getElementById('authSection').style.display = 'flex';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 15px;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Add notification styles to the page
const notificationStyles = `
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 1.2em;
        opacity: 0.8;
        transition: opacity 0.3s ease;
    }
    
    .notification-close:hover {
        opacity: 1;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet); 