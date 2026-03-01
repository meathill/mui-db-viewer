'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getErrorMessage, showErrorAlert, showSuccessToast } from '@/lib/client-feedback';
import { parseDatabaseUrl } from '@/lib/database-url';
import { pickLocalSQLiteFileHandle, isFileSystemAccessSupported } from '@/lib/local-sqlite/connection-store';
import { validateSidecarSQLitePath } from '@/lib/local-sqlite/sidecar-client';
import { validateLocalSQLiteHandle } from '@/lib/local-sqlite/sqlite-engine';
import { useDatabaseStore } from '@/stores/database-store';
import type { CreateDatabaseRequest } from '@/lib/api';

const LAST_DB_TYPE_STORAGE_KEY = 'db-viewer-last-database-type';
const DEFAULT_DB_TYPE = 'tidb';
const LOCAL_DB_TYPES = new Set(['sqlite']);

const connectionSchema = z
  .object({
    name: z.string().min(1, '请输入连接名称'),
    type: z.string(),
    host: z.string().optional(),
    port: z.string().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    localPath: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (LOCAL_DB_TYPES.has(data.type)) {
      if (!data.localPath && !data.database) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请选择 SQLite 文件，或填写 sidecar 本地路径',
          path: ['database'],
        });
      }
    } else {
      const requiredFields = ['host', 'database', 'username', 'password'];
      for (const field of requiredFields) {
        if (!data[field as keyof typeof data]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '此字段必填',
            path: [field],
          });
        }
      }
    }
  });

type ConnectionFormValues = z.infer<typeof connectionSchema>;

export function useConnectionForm(onSuccess?: () => void) {
  const createDatabase = useDatabaseStore((state) => state.createDatabase);

  const [initialType] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_DB_TYPE;
    return window.localStorage.getItem(LAST_DB_TYPE_STORAGE_KEY) || DEFAULT_DB_TYPE;
  });

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: '',
      type: initialType,
      host: '',
      port: '',
      database: '',
      username: '',
      password: '',
      localPath: '',
    },
    mode: 'onChange',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [selectedFileHandle, setSelectedFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [databaseUrlHint, setDatabaseUrlHint] = useState<{ level: 'info' | 'warning'; message: string } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  const watchType = form.watch('type');
  const isLocal = LOCAL_DB_TYPES.has(watchType);

  const setType = useCallback(
    (type: string) => {
      form.setValue('type', type);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_DB_TYPE_STORAGE_KEY, type);
      }
      setTestResult(null);
      setFormError(null);
    },
    [form],
  );

  const handleTogglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleParseDatabaseUrl = useCallback(() => {
    try {
      const parsed = parseDatabaseUrl(databaseUrl, watchType);

      form.setValue('type', parsed.type, { shouldValidate: true });
      form.setValue('host', parsed.host, { shouldValidate: true });
      form.setValue('port', parsed.port, { shouldValidate: true });
      form.setValue('database', parsed.database, { shouldValidate: true });
      form.setValue('username', parsed.username, { shouldValidate: true });
      form.setValue('password', parsed.password, { shouldValidate: true });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_DB_TYPE_STORAGE_KEY, parsed.type);
      }
      setDatabaseUrlHint(parsed.hint ?? null);
      setTestResult(null);
      setFormError(null);
    } catch (parseError) {
      const message = getErrorMessage(parseError, '解析 URL 失败');
      setDatabaseUrlHint(null);
      setFormError(message);
      showErrorAlert(message, '解析 URL 失败');
    }
  }, [databaseUrl, watchType, form]);

  const handlePickLocalFile = useCallback(async () => {
    try {
      const fileHandle = await pickLocalSQLiteFileHandle();
      setSelectedFileHandle(fileHandle);
      form.setValue('database', fileHandle.name);
      setFormError(null);

      if (!form.getValues('name')) {
        const nameWithoutExt = fileHandle.name.replace(/\.(db|sqlite|sqlite3|s3db)$/i, '');
        if (nameWithoutExt) {
          form.setValue('name', nameWithoutExt);
        }
      }
    } catch (pickError) {
      if (pickError instanceof DOMException && pickError.name === 'AbortError') return;
      const message = getErrorMessage(pickError, '选择文件失败');
      setFormError(message);
      showErrorAlert(message, '选择文件失败');
    }
  }, [form]);

  const handleTestConnection = useCallback(async () => {
    const values = form.getValues();
    setTesting(true);
    setTestResult(null);
    setFormError(null);

    try {
      if (isLocal) {
        if (values.localPath) {
          await validateSidecarSQLitePath(values.localPath);
        } else if (selectedFileHandle) {
          await validateLocalSQLiteHandle(selectedFileHandle);
        } else {
          throw new Error('请先选择 SQLite 文件，或填写 sidecar 本地路径');
        }
      } else {
        // TODO: 实际远程连接测试
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      setTestResult('success');
    } catch (testError) {
      const message = getErrorMessage(testError, '测试失败');
      setTestResult('error');
      setFormError(message);
      showErrorAlert(message, '测试失败');
    } finally {
      setTesting(false);
    }
  }, [form, isLocal, selectedFileHandle]);

  const onSubmit = async (values: ConnectionFormValues) => {
    setFormError(null);
    try {
      const payload: CreateDatabaseRequest = isLocal
        ? {
            ...values,
            database: values.database || '',
            fileHandle: selectedFileHandle ?? undefined,
            localPath: values.localPath?.trim() || undefined,
            host: '',
            username: '',
            password: '',
          }
        : (values as CreateDatabaseRequest);

      await createDatabase(payload);
      showSuccessToast('保存成功', `已添加数据库连接“${values.name || '未命名连接'}”`);
      onSuccess?.();
    } catch (err) {
      const message = getErrorMessage(err, '保存失败');
      setFormError(message);
      showErrorAlert(message, '保存失败');
    }
  };

  return {
    form,
    showPassword,
    testing,
    testResult,
    formError,
    isLocal,
    selectedFileName: selectedFileHandle?.name || '',
    databaseUrl,
    databaseUrlHint,
    fileSystemSupported: isFileSystemAccessSupported(),
    setType,
    handleTogglePasswordVisibility,
    handleDatabaseUrlChange: setDatabaseUrl,
    handleParseDatabaseUrl,
    handlePickLocalFile,
    handleTestConnection,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
