'use client'

import { useState, useEffect } from 'react'
import SectionCard from '@/components/ui/SectionCard'
import StatusChip from '@/components/ui/StatusChip'
import { ChevronDown, ChevronUp, Send } from 'lucide-react'

interface SupportTicket {
  _id: string
  subject: string
  description: string
  priority: string
  status: string
  createdAt: string
}

interface FAQ {
  question: string
  answer: string
}

const faqs: FAQ[] = [
  {
    question: 'How do I create a new booking?',
    answer:
      'Navigate to the Bookings page and click "New Booking". Fill in the customer details, select a vehicle, choose dates, and complete the booking form. The system will automatically calculate the total amount including taxes.',
  },
  {
    question: 'How can I update an invoice status?',
    answer:
      'Only users with FINANCE or SUPER_ADMIN roles can update invoice statuses. Go to the Financials page, select an invoice, and use the "Mark as Paid" or "Void Invoice" buttons.',
  },
  {
    question: 'What should I do if a vehicle needs maintenance?',
    answer:
      'Update the vehicle status to "MAINTENANCE" in the Units page. This will prevent the vehicle from being assigned to new bookings until maintenance is complete.',
  },
  {
    question: 'How do I add a new user to the system?',
    answer:
      'Only SUPER_ADMIN and ADMIN users can create new users. Go to the Manage Users page, click "Invite User", fill in the details, and the system will generate a temporary password that you can share with the new user.',
  },
  {
    question: 'Can I change my notification preferences?',
    answer:
      'Yes, go to the Settings page and adjust your Email and SMS notification preferences. Changes are saved automatically.',
  },
  {
    question: 'How do I view my support tickets?',
    answer:
      'All support tickets you create are listed on this Support page. You can see the status, priority, and creation date for each ticket.',
  },
]

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState(true)

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/support-tickets')
      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets || [])
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setIsLoadingTickets(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        alert('Support ticket created successfully!')
        setFormData({
          subject: '',
          description: '',
          priority: 'MEDIUM',
        })
        fetchTickets()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create support ticket')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to create support ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPriorityVariant = (priority: string): 'yellow' | 'green' | 'red' => {
    if (priority === 'URGENT') return 'red'
    if (priority === 'HIGH') return 'red'
    if (priority === 'MEDIUM') return 'yellow'
    return 'green'
  }

  const getStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'OPEN') return 'yellow'
    if (status === 'IN_PROGRESS') return 'yellow'
    if (status === 'RESOLVED') return 'green'
    return 'red'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-headingText">Support</h1>
        <p className="text-bodyText mt-2">Get help and create support tickets</p>
      </div>

      {/* FAQ Section */}
      <SectionCard title="Frequently Asked Questions">
        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-borderSoft rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-borderSoft/30 transition-colors"
              >
                <span className="font-medium text-headingText">{faq.question}</span>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-bodyText flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-bodyText flex-shrink-0" />
                )}
              </button>
              {openFaq === index && (
                <div className="p-4 pt-0 text-bodyText border-t border-borderSoft">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Create Support Ticket */}
      <SectionCard title="Create Support Ticket">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Subject *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              maxLength={200}
              placeholder="Brief description of your issue"
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              minLength={10}
              rows={6}
              placeholder="Please provide detailed information about your issue..."
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 resize-none"
            />
            <p className="text-xs text-sidebarMuted mt-1">
              Minimum 10 characters required
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Priority *
            </label>
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
                })
              }
              required
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="flex justify-end pt-4 border-t border-borderSoft">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* My Support Tickets */}
      <SectionCard title="My Support Tickets">
        {isLoadingTickets ? (
          <div className="text-center py-8 text-bodyText">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8 text-bodyText">No support tickets found</div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div
                key={ticket._id}
                className="p-4 bg-pageBg border border-borderSoft rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-headingText mb-1">{ticket.subject}</h3>
                    <p className="text-sm text-bodyText line-clamp-2">{ticket.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <StatusChip
                      status={ticket.priority}
                      variant={getPriorityVariant(ticket.priority)}
                    />
                    <StatusChip
                      status={ticket.status.replace('_', ' ')}
                      variant={getStatusVariant(ticket.status)}
                    />
                  </div>
                </div>
                <div className="text-xs text-sidebarMuted mt-2">
                  Created: {formatDate(ticket.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

