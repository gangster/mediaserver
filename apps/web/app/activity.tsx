/**
 * Activity Page
 *
 * Real-time monitoring of background jobs and system activity.
 */

import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { Text } from '@mediaserver/ui';
import { Layout } from '../src/components/layout';
import { Ionicons } from '@expo/vector-icons';
import {
  useJobs,
  useJobStats,
  useActiveJobs,
  useCancelJob,
  useRetryJob,
  useRemoveJob,
  useClearCompletedJobs,
} from '@mediaserver/api-client';

type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
type JobType = 'scan' | 'metadata_refresh' | 'metadata_identify' | 'transcode' | 'thumbnail' | 'cleanup';

interface Job {
  id: string;
  queue: string;
  type: JobType;
  status: JobStatus;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  progress?: number;
  progressMessage?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

const STATUS_COLORS: Record<JobStatus, string> = {
  waiting: '#f59e0b',
  active: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  delayed: '#8b5cf6',
  paused: '#6b7280',
};

const STATUS_LABELS: Record<JobStatus, string> = {
  waiting: 'Waiting',
  active: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  delayed: 'Delayed',
  paused: 'Paused',
};

const TYPE_LABELS: Record<JobType, string> = {
  scan: 'Library Scan',
  metadata_refresh: 'Metadata Refresh',
  metadata_identify: 'Identify Media',
  transcode: 'Transcode',
  thumbnail: 'Thumbnail',
  cleanup: 'Cleanup',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: JobStatus }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <View
      style={{
        backgroundColor: `${color}20`,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {status === 'active' && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      )}
      <Text style={{ fontSize: 11, color, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

function JobCard({
  job,
  onCancel,
  onRetry,
  onRemove,
}: {
  job: Job;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        gap: 12,
      })}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={job.status} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
            {TYPE_LABELS[job.type] ?? job.type}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          {formatTime(job.createdAt)}
        </Text>
      </View>

      {/* Progress bar for active jobs */}
      {job.status === 'active' && job.progress !== undefined && (
        <View>
          <View
            style={{
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${job.progress}%`,
                backgroundColor: '#3b82f6',
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {job.progressMessage ?? `${Math.round(job.progress)}%`}
          </Text>
        </View>
      )}

      {/* Target info */}
      {job.targetName && (
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          {job.targetName}
        </Text>
      )}

      {/* Error message for failed jobs */}
      {job.status === 'failed' && job.error && (
        <View
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            padding: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 12, color: '#ef4444' }}>{job.error}</Text>
        </View>
      )}

      {/* Duration for completed jobs */}
      {job.status === 'completed' && job.durationMs && (
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          Completed in {formatDuration(job.durationMs)}
        </Text>
      )}

      {/* Expanded actions */}
      {expanded && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {job.status === 'failed' && (
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: pressed ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)',
                paddingVertical: 8,
                borderRadius: 6,
              })}
            >
              <Ionicons name="refresh" size={14} color="#3b82f6" />
              <Text style={{ fontSize: 13, color: '#3b82f6' }}>Retry</Text>
            </Pressable>
          )}
          {(job.status === 'waiting' || job.status === 'active') && (
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: pressed ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)',
                paddingVertical: 8,
                borderRadius: 6,
              })}
            >
              <Ionicons name="close" size={14} color="#ef4444" />
              <Text style={{ fontSize: 13, color: '#ef4444' }}>Cancel</Text>
            </Pressable>
          )}
          {(job.status === 'completed' || job.status === 'failed') && (
            <Pressable
              onPress={onRemove}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                paddingVertical: 8,
                borderRadius: 6,
              })}
            >
              <Ionicons name="trash-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Remove</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  color = '#fff',
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        flex: 1,
        minWidth: 120,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700', color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

export default function ActivityPage() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>(undefined);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useJobStats();
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useJobs({
    page,
    limit: 20,
    status: statusFilter,
  });
  const { data: activeJobs } = useActiveJobs();

  const cancelJob = useCancelJob();
  const retryJob = useRetryJob();
  const removeJob = useRemoveJob();
  const clearCompleted = useClearCompletedJobs();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchJobs()]);
    setRefreshing(false);
  }, [refetchStats, refetchJobs]);

  const handleCancel = useCallback(async (id: string) => {
    await cancelJob.mutateAsync({ id });
    refetchJobs();
  }, [cancelJob, refetchJobs]);

  const handleRetry = useCallback(async (id: string) => {
    await retryJob.mutateAsync({ id });
    refetchJobs();
  }, [retryJob, refetchJobs]);

  const handleRemove = useCallback(async (id: string) => {
    await removeJob.mutateAsync({ id });
    refetchJobs();
  }, [removeJob, refetchJobs]);

  const handleClearCompleted = useCallback(async () => {
    await clearCompleted.mutateAsync({ olderThanDays: 0 });
    refetchJobs();
    refetchStats();
  }, [clearCompleted, refetchJobs, refetchStats]);

  const isLoading = statsLoading || jobsLoading;

  return (
    <Layout>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#09090b' }}
        contentContainerStyle={{ padding: isDesktop ? 24 : 16, gap: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>Activity</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              Background jobs and system activity
            </Text>
          </View>
          {stats?.byStatus?.completed && stats.byStatus.completed > 0 && (
            <Pressable
              onPress={handleClearCompleted}
              disabled={clearCompleted.isPending}
              style={({ pressed }) => ({
                backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                opacity: clearCompleted.isPending ? 0.5 : 1,
              })}
            >
              <Text style={{ fontSize: 13, color: '#fff' }}>Clear Completed</Text>
            </Pressable>
          )}
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatCard
            label="Active"
            value={stats?.byStatus?.active ?? 0}
            color="#3b82f6"
          />
          <StatCard
            label="Waiting"
            value={stats?.byStatus?.waiting ?? 0}
            color="#f59e0b"
          />
          <StatCard
            label="Completed"
            value={stats?.byStatus?.completed ?? 0}
            color="#22c55e"
          />
          <StatCard
            label="Failed"
            value={stats?.byStatus?.failed ?? 0}
            color="#ef4444"
          />
        </View>

        {/* Active Jobs */}
        {activeJobs && activeJobs.length > 0 && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
              Currently Running
            </Text>
            {activeJobs.map((job: Job) => (
              <JobCard
                key={job.id}
                job={job}
                onCancel={() => handleCancel(job.id)}
                onRetry={() => handleRetry(job.id)}
                onRemove={() => handleRemove(job.id)}
              />
            ))}
          </View>
        )}

        {/* Filter tabs */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[undefined, 'waiting', 'active', 'completed', 'failed'].map((status) => (
            <Pressable
              key={status ?? 'all'}
              onPress={() => {
                setStatusFilter(status as JobStatus | undefined);
                setPage(1);
              }}
              style={({ pressed }) => ({
                backgroundColor:
                  statusFilter === status
                    ? '#e50914'
                    : pressed
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(255,255,255,0.1)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
              })}
            >
              <Text style={{ fontSize: 13, color: '#fff' }}>
                {status ? STATUS_LABELS[status as JobStatus] : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Jobs list */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
            Job History
            {jobs?.total ? ` (${jobs.total})` : ''}
          </Text>

          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)' }}>Loading...</Text>
            </View>
          ) : jobs?.items && jobs.items.length > 0 ? (
            <>
              {jobs.items.map((job: Job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={() => handleCancel(job.id)}
                  onRetry={() => handleRetry(job.id)}
                  onRemove={() => handleRemove(job.id)}
                />
              ))}

              {/* Pagination */}
              {jobs.totalPages > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 16,
                  }}
                >
                  <Pressable
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={({ pressed }) => ({
                      opacity: page === 1 ? 0.5 : 1,
                      backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                    })}
                  >
                    <Text style={{ color: '#fff' }}>Previous</Text>
                  </Pressable>
                  <Text style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Page {page} of {jobs.totalPages}
                  </Text>
                  <Pressable
                    onPress={() => setPage((p) => Math.min(jobs.totalPages, p + 1))}
                    disabled={page === jobs.totalPages}
                    style={({ pressed }) => ({
                      opacity: page === jobs.totalPages ? 0.5 : 1,
                      backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                    })}
                  >
                    <Text style={{ color: '#fff' }}>Next</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <View
              style={{
                padding: 40,
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 12,
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>
                No jobs found
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Layout>
  );
}

