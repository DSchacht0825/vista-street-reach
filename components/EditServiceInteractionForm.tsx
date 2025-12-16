'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  encounterFormSchema,
  type EncounterFormData,
  CO_OCCURRING_TYPES,
  PLACEMENT_LOCATIONS,
  OUTREACH_WORKERS,
  SUPPORT_SERVICES,
} from '@/lib/schemas/encounter-schema'
import { REFERRAL_SOURCES } from '@/lib/schemas/intake-schema'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Encounter {
  id: string
  person_id: string
  service_date: string
  outreach_location: string
  latitude: number
  longitude: number
  outreach_worker: string
  referral_source: string | null
  language_preference: string | null
  cultural_notes: string | null
  co_occurring_mh_sud: boolean
  co_occurring_type: string | null
  transportation_provided: boolean
  shower_trailer: boolean
  support_services: string[] | null
  other_services: string | null
  placement_made: boolean
  placement_location: string | null
  placement_location_other: string | null
  placement_detox_name: string | null
  refused_shelter: boolean
  shelter_unavailable: boolean
  high_utilizer_contact: boolean
  case_management_notes: string | null
  follow_up: boolean
  photo_urls: string[] | null
}

interface EditServiceInteractionFormProps {
  personId: string
  personName: string
  encounter: Encounter
}

export default function EditServiceInteractionForm({
  personId,
  personName,
  encounter,
}: EditServiceInteractionFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Photo state - existing photos from database and new photos to add
  const [existingPhotos, setExistingPhotos] = useState<string[]>(encounter.photo_urls || [])
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([])
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)

  // Parse the service date to get just the date part (YYYY-MM-DD)
  const serviceDate = encounter.service_date.split('T')[0]

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<EncounterFormData>({
    resolver: zodResolver(encounterFormSchema) as any,
    defaultValues: {
      service_date: serviceDate,
      outreach_location: encounter.outreach_location,
      outreach_worker: encounter.outreach_worker,
      referral_source: encounter.referral_source || '',
      // Preserve original GPS coordinates
      latitude: encounter.latitude,
      longitude: encounter.longitude,
      language_preference: encounter.language_preference || '',
      cultural_notes: encounter.cultural_notes || '',
      co_occurring_mh_sud: encounter.co_occurring_mh_sud,
      co_occurring_type: encounter.co_occurring_type || '',
      transportation_provided: encounter.transportation_provided,
      shower_trailer: encounter.shower_trailer,
      support_services: encounter.support_services || [],
      other_services: encounter.other_services || '',
      placement_made: encounter.placement_made,
      placement_location: encounter.placement_location || '',
      placement_location_other: encounter.placement_location_other || '',
      placement_detox_name: encounter.placement_detox_name || '',
      refused_shelter: encounter.refused_shelter,
      shelter_unavailable: encounter.shelter_unavailable,
      high_utilizer_contact: encounter.high_utilizer_contact,
      case_management_notes: encounter.case_management_notes || '',
      follow_up: encounter.follow_up,
    },
  })

  // Watch conditional fields
  const coOccurring = watch('co_occurring_mh_sud')
  const placementMade = watch('placement_made')
  const placementLocation = watch('placement_location')

  // Handle new photo file selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => file.type.startsWith('image/'))

    if (validFiles.length > 0) {
      setNewPhotoFiles(prev => [...prev, ...validFiles])

      // Create previews for each file
      validFiles.forEach(file => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setNewPhotoPreviews(prev => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
      })
    }
    // Reset input to allow selecting same file again
    e.target.value = ''
  }

  // Remove an existing photo
  const removeExistingPhoto = (index: number) => {
    setExistingPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Remove a new photo
  const removeNewPhoto = (index: number) => {
    setNewPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setNewPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Upload a single photo to Supabase storage
  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from('encounter-photos')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('encounter-photos')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading photo:', error)
      return null
    }
  }

  // Upload all new photos and return URLs
  const uploadAllPhotos = async (): Promise<string[]> => {
    if (newPhotoFiles.length === 0) return []

    setIsUploadingPhotos(true)
    try {
      const uploadPromises = newPhotoFiles.map(file => uploadPhoto(file))
      const urls = await Promise.all(uploadPromises)
      return urls.filter((url): url is string => url !== null)
    } finally {
      setIsUploadingPhotos(false)
    }
  }

  const onSubmit = async (data: EncounterFormData) => {
    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // Upload any new photos
      const newPhotoUrls = await uploadAllPhotos()

      // Combine existing photos (that weren't removed) with new uploads
      const allPhotoUrls = [...existingPhotos, ...newPhotoUrls]

      // Update the encounter - PRESERVE original GPS coordinates
      const { error } = await supabase
        .from('encounters')
        .update({
          // Use Pacific timezone (noon) to avoid date shifting when converting to/from UTC
          service_date: `${data.service_date}T12:00:00-08:00`,
          outreach_location: data.outreach_location,
          // DO NOT update latitude/longitude - preserve original GPS
          outreach_worker: data.outreach_worker,
          referral_source: data.referral_source || null,
          language_preference: data.language_preference || null,
          cultural_notes: data.cultural_notes || null,
          co_occurring_mh_sud: data.co_occurring_mh_sud,
          co_occurring_type: data.co_occurring_type || null,
          transportation_provided: data.transportation_provided,
          shower_trailer: data.shower_trailer,
          support_services: data.support_services || [],
          other_services: data.other_services || null,
          placement_made: data.placement_made,
          placement_location: data.placement_location || null,
          placement_location_other: data.placement_location_other || null,
          placement_detox_name: data.placement_detox_name || null,
          refused_shelter: data.refused_shelter,
          shelter_unavailable: data.shelter_unavailable,
          high_utilizer_contact: data.high_utilizer_contact,
          case_management_notes: data.case_management_notes || null,
          follow_up: data.follow_up,
          photo_urls: allPhotoUrls.length > 0 ? allPhotoUrls : null,
        } as never)
        .eq('id', encounter.id)

      if (error) throw error

      // Success! Navigate back to client profile
      router.push(`/client/${personId}`)
    } catch (error) {
      console.error('Error updating service interaction:', error)
      alert('Error updating service interaction. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* GPS Location - Read Only */}
      <div className="bg-gray-100 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <svg
            className="w-6 h-6 mr-2 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          GPS Location (Preserved)
        </h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700 font-medium">Original location preserved</p>
          <p className="text-sm text-blue-600 mt-1">
            Coordinates: {encounter.latitude.toFixed(6)}, {encounter.longitude.toFixed(6)}
          </p>
          <p className="text-xs text-blue-500 mt-2">
            GPS coordinates cannot be changed when editing an interaction
          </p>
        </div>
      </div>

      {/* Basic Service Information */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Service Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <p className="text-lg font-medium text-gray-900 mb-4">
              Client: {personName}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Date <span className="text-red-500">*</span>
            </label>
            <input
              {...register('service_date')}
              type="date"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
            {errors.service_date && (
              <p className="text-red-500 text-sm mt-1">{errors.service_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outreach Worker <span className="text-red-500">*</span>
            </label>
            <select
              {...register('outreach_worker')}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            >
              <option value="">Select outreach worker</option>
              {OUTREACH_WORKERS.map((worker) => (
                <option key={worker} value={worker}>
                  {worker}
                </option>
              ))}
            </select>
            {errors.outreach_worker && (
              <p className="text-red-500 text-sm mt-1">{errors.outreach_worker.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location/Area <span className="text-red-500">*</span>
            </label>
            <input
              {...register('outreach_location')}
              type="text"
              placeholder="e.g., Main St & 1st Ave"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
            {errors.outreach_location && (
              <p className="text-red-500 text-sm mt-1">{errors.outreach_location.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referral Source
            </label>
            <select
              {...register('referral_source')}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            >
              <option value="">Select source...</option>
              {REFERRAL_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mental Health Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Mental Health</h2>
        <div className="space-y-4">
          {/* Co-occurring */}
          <div>
            <div className="flex items-center mb-2">
              <input
                {...register('co_occurring_mh_sud')}
                type="checkbox"
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Co-occurring Mental Health & Substance Use
              </label>
            </div>
            {coOccurring && (
              <div className="ml-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type of Co-occurring Condition
                </label>
                <select
                  {...register('co_occurring_type')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                >
                  <option value="">Select type...</option>
                  {CO_OCCURRING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Other Services Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Services Provided</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              {...register('transportation_provided')}
              type="checkbox"
              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Transportation Provided
            </label>
          </div>

          <div className="flex items-center">
            <input
              {...register('shower_trailer')}
              type="checkbox"
              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Shower Trailer Access
            </label>
          </div>

          {/* Support Services Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Support Services Provided
            </label>
            <div className="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-200">
              {SUPPORT_SERVICES.map((service) => (
                <div key={service.value} className="flex items-center">
                  <input
                    type="checkbox"
                    value={service.value}
                    {...register('support_services')}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    {service.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other Services (clothing, hygiene items, etc.)
            </label>
            <textarea
              {...register('other_services')}
              rows={2}
              placeholder="Describe any other services provided..."
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          </div>

          {/* Follow-up Required */}
          <div className="mt-4">
            <label className="flex items-center space-x-2 cursor-pointer bg-purple-50 hover:bg-purple-100 border-2 border-purple-300 rounded-lg px-4 py-3 transition-colors">
              <input
                {...register('follow_up')}
                type="checkbox"
                className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="text-sm font-semibold text-purple-900">
                Follow-up Required
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-1">
              Check if this client needs follow-up contact
            </p>
          </div>
        </div>
      </div>

      {/* Placement Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Placement
        </h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              {...register('placement_made')}
              type="checkbox"
              className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700 font-medium">
              Placement Made
            </label>
          </div>

          {placementMade && (
            <div className="ml-6 space-y-4 border-l-2 border-green-200 pl-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Placement Location
                </label>
                <select
                  {...register('placement_location')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                >
                  <option value="">Select location...</option>
                  {PLACEMENT_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              {placementLocation === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Other Placement Location
                  </label>
                  <input
                    {...register('placement_location_other')}
                    type="text"
                    placeholder="Specify placement location..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                  />
                </div>
              )}

              {placementLocation === 'Detox' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detox Facility Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('placement_detox_name')}
                    type="text"
                    placeholder="Enter detox facility name..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center mt-4">
            <label className="flex items-center space-x-2 cursor-pointer bg-red-50 hover:bg-red-100 border-2 border-red-300 rounded-lg px-4 py-3 transition-colors w-full">
              <input
                {...register('refused_shelter')}
                type="checkbox"
                className="h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="text-sm font-semibold text-red-900">
                Refused Shelter
              </span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1 ml-1">
            Check if client declined shelter placement when offered
          </p>

          <div className="flex items-center mt-4">
            <label className="flex items-center space-x-2 cursor-pointer bg-orange-50 hover:bg-orange-100 border-2 border-orange-300 rounded-lg px-4 py-3 transition-colors w-full">
              <input
                {...register('shelter_unavailable')}
                type="checkbox"
                className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <span className="text-sm font-semibold text-orange-900">
                Shelter Unavailable
              </span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1 ml-1">
            Check if no shelter beds were available
          </p>
        </div>
      </div>

      {/* Case Management Notes */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Case Management Notes</h2>

        <div className="mb-4">
          <label className="flex items-center space-x-2 cursor-pointer bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-300 rounded-lg px-4 py-3 transition-colors">
            <input
              {...register('high_utilizer_contact')}
              type="checkbox"
              className="h-5 w-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
            />
            <span className="text-sm font-semibold text-yellow-900">
              High Utilizer Contact
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-1">
            Check if this client is a frequent service user
          </p>
        </div>

        <textarea
          {...register('case_management_notes')}
          rows={6}
          placeholder="Progress notes, follow-up needed, client goals, barriers, successes..."
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />

        {/* Photo Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Photos
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Capture photos of injuries, encampments, or other documentation
          </p>

          {/* Photo capture button */}
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>

          {/* Existing photos */}
          {existingPhotos.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Existing Photos</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {existingPhotos.map((url, index) => (
                  <div key={`existing-${index}`} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New photos to upload */}
          {newPhotoPreviews.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-600 mb-2">New Photos (will upload on save)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {newPhotoPreviews.map((preview, index) => (
                  <div key={`new-${index}`} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={`New photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-green-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isUploadingPhotos && (
            <div className="mt-4 text-center text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 inline-block mr-2"></div>
              Uploading photos...
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
