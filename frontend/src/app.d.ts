declare global {
  namespace App {
    interface Locals {
      user: {
        id: number;
        username: string;
        display_name: string;
        email: string;
        role: string;
        ldap_groups: string[];
      } | null;
    }
  }
}

export {};
