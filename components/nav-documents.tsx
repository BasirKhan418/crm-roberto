"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useLocale } from "@/components/providers/locale-provider"
import { MoreHorizontalIcon, FolderIcon, ShareIcon, Trash2Icon } from "lucide-react"

export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
}) {
  const { isMobile } = useSidebar()
  const { locale } = useLocale()
  const t = {
    en: {
      documents: "Documents",
      more: "More",
      open: "Open",
      share: "Share",
      delete: "Delete",
    },
    fr: {
      documents: "Documents",
      more: "Plus",
      open: "Ouvrir",
      share: "Partager",
      delete: "Supprimer",
    },
  }[locale]

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t.documents}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                {item.icon}
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="rounded-sm data-[state=open]:bg-accent"
                >
                  <MoreHorizontalIcon
                  />
                  <span className="sr-only">{t.more}</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-24 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <FolderIcon
                  />
                  <span>{t.open}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShareIcon
                  />
                  <span>{t.share}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <Trash2Icon
                  />
                  <span>{t.delete}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <MoreHorizontalIcon className="text-sidebar-foreground/70" />
            <span>{t.more}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
