import React, { useState, useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { addYears, addMonths, format } from 'date-fns'
import { Upload, X, FileText, Scan, ShieldOff, Camera, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import { runOcr } from '../lib/ocr'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { DateInput } from './ui/DateInput'
import { Select } from './ui/Select'
import { productsApi } from '../lib/api'
import type { Product, ProductCategory } from '../types'
import { cn, SUPPORTED_CURRENCIES } from '../lib/utils'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product
  onSuccess: () => void
}

interface FormValues {
  name: string
  brand: string
  category: ProductCategory
  purchase_date: string
  price: string
  currency: string
  expiry_date: string
  serial_number: string
  store_name: string
  notes: string
  // duration mode fields
  durationValue: string
  durationUnit: 'years' | 'months'
}

const CATEGORIES: ProductCategory[] = ['Electronics', 'Appliances', 'Vehicles', 'Gadgets', 'Home', 'Furniture', 'Other']

export function ProductModal({ isOpen, onClose, product, onSuccess }: ProductModalProps) {
  const isEditing = !!product
  const [expiryMode, setExpiryMode] = useState<'duration' | 'manual' | 'none'>('duration')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      brand: '',
      category: 'Electronics',
      purchase_date: '',
      price: '',
      currency: 'USD',
      expiry_date: '',
      serial_number: '',
      store_name: '',
      notes: '',
      durationValue: '1',
      durationUnit: 'years',
    },
  })

  const purchaseDate = useWatch({ control, name: 'purchase_date' })
  const durationValue = useWatch({ control, name: 'durationValue' })
  const durationUnit = useWatch({ control, name: 'durationUnit' })

  // Auto-calculate expiry when in duration mode
  useEffect(() => {
    if (expiryMode === 'duration' && purchaseDate) {
      try {
        const base = new Date(purchaseDate)
        const val = parseInt(durationValue || '1', 10) || 1
        const expiry = durationUnit === 'years'
          ? addYears(base, val)
          : addMonths(base, val)
        setValue('expiry_date', format(expiry, 'yyyy-MM-dd'))
      } catch {
        // invalid date
      }
    }
    if (expiryMode === 'none') {
      setValue('expiry_date', '')
    }
  }, [purchaseDate, durationValue, durationUnit, expiryMode, setValue])

  // Populate form when editing
  useEffect(() => {
    if (isOpen && product) {
      const initialMode = product.expiryDate == null ? 'none' : 'manual'
      setExpiryMode(initialMode)
      reset({
        name: product.name,
        brand: product.brand ?? '',
        category: product.category,
        purchase_date: product.purchaseDate.substring(0, 10),
        price: product.price != null ? product.price.toString() : '',
        currency: product.currency ?? 'USD',
        expiry_date: product.expiryDate ? product.expiryDate.substring(0, 10) : '',
        serial_number: product.serialNumber ?? '',
        store_name: product.storeName ?? '',
        notes: product.notes ?? '',
        durationValue: '1',
        durationUnit: 'years',
      })
      setSelectedFile(null)
      setSelectedPhoto(null)
      setPhotoPreview(product.photoPath ?? null)
      setError(null)
    } else if (isOpen && !product) {
      setExpiryMode('duration')
      reset({
        name: '',
        brand: '',
        category: 'Electronics',
        purchase_date: '',
        price: '',
        currency: 'USD',
        expiry_date: '',
        serial_number: '',
        store_name: '',
        notes: '',
        durationValue: '1',
        durationUnit: 'years',
      })
      setSelectedFile(null)
      setSelectedPhoto(null)
      setPhotoPreview(null)
      setError(null)
    }
  }, [isOpen, product, reset])

  const onSubmit = async (data: FormValues) => {
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('name', data.name)
      fd.append('brand', data.brand)
      fd.append('category', data.category)
      fd.append('purchase_date', data.purchase_date)
      if (expiryMode !== 'none' && data.expiry_date) {
        fd.append('expiry_date', data.expiry_date)
      } else {
        fd.append('expiry_date', '')
      }
      if (data.price.trim()) {
        fd.append('price', data.price.trim())
        fd.append('currency', data.currency)
      }
      fd.append('serial_number', data.serial_number)
      fd.append('store_name', data.store_name)
      fd.append('notes', data.notes)
      if (selectedFile) {
        fd.append('document', selectedFile)
      }
      if (selectedPhoto) {
        fd.append('photo', selectedPhoto)
      }

      if (isEditing && product) {
        await productsApi.update(product.id, fd)
      } else {
        await productsApi.create(fd)
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      const msg = e?.response?.data?.error ?? 'Failed to save product. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed')
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be under 5MB')
      e.target.value = ''
      return
    }
    setSelectedFile(file)
  }

  const removeFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error('Photo must be JPEG, PNG, GIF, or WebP')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB')
      e.target.value = ''
      return
    }
    setSelectedPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const removePhoto = () => {
    setSelectedPhoto(null)
    setPhotoPreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleRunOcr = async () => {
    if (!selectedFile) return
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('OCR only works on image files')
      return
    }
    setOcrLoading(true)
    try {
      const result = await runOcr(selectedFile)
      let applied = 0
      if (result.purchaseDate) {
        setValue('purchase_date', result.purchaseDate, { shouldDirty: true })
        applied += 1
      }
      if (result.serialNumber) {
        setValue('serial_number', result.serialNumber, { shouldDirty: true })
        applied += 1
      }
      if (applied > 0) {
        toast.success(`Extracted ${applied} field${applied === 1 ? '' : 's'} from image`)
      } else {
        toast('No purchase date or serial number detected', { icon: 'ℹ️' })
      }
    } catch {
      toast.error('Failed to extract text from image')
    } finally {
      setOcrLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Product' : 'Add Product / Purchase'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Name + Brand */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Product Name *"
            placeholder="e.g. MacBook Pro"
            error={errors.name?.message}
            {...register('name', { required: 'Product name is required' })}
          />
          <Input
            label="Brand"
            placeholder="e.g. Apple"
            {...register('brand')}
          />
        </div>

        {/* Category */}
        <Select
          label="Category"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          {...register('category')}
        />

        {/* Product Photo */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
            <Camera className="inline h-4 w-4 mr-1 -mt-0.5" />
            Product Photo
          </label>
          {photoPreview ? (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group">
              <img src={photoPreview} alt="Product" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="bg-white/90 text-gray-800 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-white"
                >
                  <Image className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Change
                </button>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="bg-red-500/90 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-600"
                >
                  <X className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => photoInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl',
                'flex flex-col items-center justify-center gap-2 p-5 cursor-pointer h-32',
                'hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors',
              )}
            >
              <Camera className="h-7 w-7 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Click to add a product photo</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">JPEG, PNG, WebP (max 5MB)</p>
            </div>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        {/* Purchase Date + Price + Currency */}
        <div className="grid grid-cols-3 gap-4">
          <DateInput
            label="Purchase Date *"
            error={errors.purchase_date?.message}
            onValueChange={(v) => setValue('purchase_date', v, { shouldValidate: true, shouldDirty: true })}
            {...register('purchase_date', { required: 'Purchase date is required' })}
          />
          <Input
            type="number"
            label="Price Paid"
            placeholder="0.00"
            step="0.01"
            min="0"
            error={errors.price?.message}
            {...register('price', {
              validate: (v) => {
                if (!v || v.trim() === '') return true
                const n = parseFloat(v)
                if (isNaN(n) || n < 0) return 'Enter a valid positive amount'
                return true
              },
            })}
          />
          <Select
            label="Currency"
            options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: c.code }))}
            {...register('currency')}
          />
        </div>

        {/* Warranty section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Warranty</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 ml-auto">
              <button
                type="button"
                onClick={() => setExpiryMode('duration')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  expiryMode === 'duration'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                Duration
              </button>
              <button
                type="button"
                onClick={() => setExpiryMode('manual')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-700',
                  expiryMode === 'manual'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                Manual Date
              </button>
              <button
                type="button"
                onClick={() => setExpiryMode('none')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-700',
                  expiryMode === 'none'
                    ? 'bg-gray-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                No warranty
              </button>
            </div>
          </div>

          {expiryMode === 'duration' ? (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  label="Duration"
                  min="1"
                  max="100"
                  placeholder="1"
                  {...register('durationValue')}
                />
              </div>
              <div className="flex-1">
                <Select
                  label="Unit"
                  options={[
                    { value: 'years', label: 'Years' },
                    { value: 'months', label: 'Months' },
                  ]}
                  {...register('durationUnit')}
                />
              </div>
              {errors.expiry_date && (
                <p className="text-xs text-red-500 mt-1">{errors.expiry_date.message}</p>
              )}
            </div>
          ) : expiryMode === 'manual' ? (
            <DateInput
              label="Expiry Date *"
              error={errors.expiry_date?.message}
              onValueChange={(v) => setValue('expiry_date', v, { shouldValidate: true, shouldDirty: true })}
              {...register('expiry_date', {
                required: expiryMode === 'manual' ? 'Expiry date is required' : false,
              })}
            />
          ) : (
            <div className="flex items-center gap-3 py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700">
              <ShieldOff className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No warranty tracked — this product will be stored as a general purchase record.
              </p>
            </div>
          )}

          {/* Computed expiry preview (duration mode) */}
          {expiryMode === 'duration' && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Calculated expiry date: {errors.expiry_date ? 'N/A' : (() => {
                try {
                  const base = new Date(purchaseDate)
                  if (isNaN(base.getTime())) return 'Select purchase date first'
                  const val = parseInt(durationValue || '1', 10) || 1
                  const expiry = durationUnit === 'years'
                    ? addYears(base, val)
                    : addMonths(base, val)
                  return format(expiry, 'MMM d, yyyy')
                } catch {
                  return 'N/A'
                }
              })()}
            </div>
          )}
        </div>

        {/* Serial + Store */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Serial Number"
            placeholder="e.g. SN123456"
            {...register('serial_number')}
          />
          <Input
            label="Store / Retailer"
            placeholder="e.g. Best Buy"
            {...register('store_name')}
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea
            rows={3}
            placeholder="Any additional information..."
            className={cn(
              'w-full rounded-lg border bg-white dark:bg-gray-900',
              'px-3 py-2 text-sm text-gray-900 dark:text-gray-100',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'border-gray-300 dark:border-gray-700',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              'resize-none',
            )}
            {...register('notes')}
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
            Receipt / Warranty Document
          </label>

          {isEditing && product?.documentPath && !selectedFile && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Existing document uploaded</span>
              <a
                href={product.documentPath}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-primary-600 dark:text-primary-400 hover:underline text-xs flex-shrink-0"
              >
                View
              </a>
            </div>
          )}

          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                <FileText className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                <span className="text-sm text-primary-700 dark:text-primary-300 truncate flex-1">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-800 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {selectedFile.type.startsWith('image/') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={ocrLoading}
                  onClick={handleRunOcr}
                >
                  <Scan className="h-4 w-4" /> Extract info from image
                </Button>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl',
                'flex flex-col items-center justify-center gap-2 p-6 cursor-pointer',
                'hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors',
              )}
            >
              <Upload className="h-8 w-8 text-gray-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Click to upload receipt or document
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">PDF, JPG, PNG (max 5MB)</p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Save Changes' : 'Add Product'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
